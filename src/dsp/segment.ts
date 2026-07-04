/**
 * Note segmentation: turn a frame-level pitch track into discrete note events.
 *
 * Humming is messy — vibrato, pitch drift, breath noise, and YIN's classic
 * octave errors. The strategy:
 *   1. Gate frames by confidence and energy (unvoiced → silence).
 *   2. Median-filter the semitone track to kill single-frame outliers.
 *   3. Correct isolated octave jumps (±12 semitones against neighbors).
 *   4. Split into segments on silence gaps or sustained pitch moves of
 *      more than half a semitone.
 *   5. Emit one note per segment (median pitch), dropping blips shorter
 *      than a minimum duration.
 */

import type { NoteEvent, PitchFrame } from "./types";
import { hzToMidiFloat } from "./types";

export interface SegmentOptions {
  /** Frames below this confidence are treated as unvoiced. */
  minConfidence: number;
  /** Frames below this fraction of the track's peak RMS are unvoiced. */
  minRmsRatio: number;
  /** Median filter half-width in frames. */
  medianRadius: number;
  /** Notes shorter than this many seconds are discarded. */
  minNoteDuration: number;
  /** A sustained move of at least this many semitones starts a new note. */
  splitSemitones: number;
  /** Frames a new pitch level must persist before we commit the split. */
  splitHoldFrames: number;
}

export const DEFAULT_SEGMENT_OPTIONS: SegmentOptions = {
  minConfidence: 0.5,
  minRmsRatio: 0.05,
  medianRadius: 4,
  minNoteDuration: 0.09,
  splitSemitones: 0.5,
  splitHoldFrames: 5,
};

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Convert frames to a per-frame semitone value (NaN = unvoiced), gated,
 * median-filtered, and octave-corrected.
 */
export function cleanSemitoneTrack(frames: PitchFrame[], opts: SegmentOptions): number[] {
  const peakRms = Math.max(...frames.map((f) => f.rms), 1e-9);
  const raw = frames.map((f) =>
    f.hz > 0 && f.confidence >= opts.minConfidence && f.rms >= peakRms * opts.minRmsRatio
      ? hzToMidiFloat(f.hz)
      : NaN,
  );

  // Median filter over voiced neighborhoods.
  const filtered = raw.map((v, i) => {
    if (Number.isNaN(v)) return NaN;
    const window: number[] = [];
    for (let j = i - opts.medianRadius; j <= i + opts.medianRadius; j++) {
      const w = raw[j];
      if (j >= 0 && j < raw.length && !Number.isNaN(w)) window.push(w);
    }
    return window.length ? median(window) : v;
  });

  // Octave-jump correction: if a run of frames sits ~12 semitones away from
  // both its voiced neighbors, fold it back.
  const voicedMedian = median(filtered.filter((v) => !Number.isNaN(v)));
  return filtered.map((v) => {
    if (Number.isNaN(v)) return v;
    let out = v;
    while (out - voicedMedian > 7.5) out -= 12;
    while (voicedMedian - out > 7.5) out += 12;
    // Only accept the fold if it landed near an existing register; otherwise
    // keep the original (wide-range melodies are legitimate).
    return Math.abs(out - v) % 12 === 0 && Math.abs(out - voicedMedian) < Math.abs(v - voicedMedian)
      ? out
      : v;
  });
}

interface RawSegment {
  startFrame: number;
  endFrame: number; // exclusive
}

/** Split the cleaned track into contiguous voiced segments, then split again on pitch moves. */
function splitSegments(track: number[], opts: SegmentOptions): RawSegment[] {
  const segments: RawSegment[] = [];
  let i = 0;
  while (i < track.length) {
    if (Number.isNaN(track[i])) {
      i++;
      continue;
    }
    // Voiced run [i, j)
    let j = i;
    while (j < track.length && !Number.isNaN(track[j])) j++;

    // Within the run, walk a reference level and split when the pitch moves
    // by >= splitSemitones and holds for splitHoldFrames.
    let segStart = i;
    let refWindow: number[] = [track[i]];
    for (let k = i + 1; k < j; k++) {
      const ref = median(refWindow);
      if (Math.abs(track[k] - ref) >= opts.splitSemitones) {
        // Candidate split: does the new level hold?
        const holdEnd = Math.min(k + opts.splitHoldFrames, j);
        let holds = holdEnd - k >= Math.min(opts.splitHoldFrames, j - k);
        for (let m = k; m < holdEnd && holds; m++) {
          if (Math.abs(track[m] - ref) < opts.splitSemitones) holds = false;
        }
        if (holds) {
          segments.push({ startFrame: segStart, endFrame: k });
          segStart = k;
          refWindow = [track[k]];
          continue;
        }
      }
      refWindow.push(track[k]);
      if (refWindow.length > 20) refWindow.shift();
    }
    segments.push({ startFrame: segStart, endFrame: j });
    i = j;
  }
  return segments;
}

/** Full segmentation: frames → note events. */
export function segmentNotes(
  frames: PitchFrame[],
  opts: SegmentOptions = DEFAULT_SEGMENT_OPTIONS,
): NoteEvent[] {
  if (frames.length === 0) return [];
  const track = cleanSemitoneTrack(frames, opts);
  const segments = splitSegments(track, opts);
  const frameDt = frames.length > 1 ? frames[1].time - frames[0].time : 0.01;

  const notes: NoteEvent[] = [];
  for (const seg of segments) {
    const start = frames[seg.startFrame].time;
    const duration = (seg.endFrame - seg.startFrame) * frameDt;
    if (duration < opts.minNoteDuration) continue;

    const semis: number[] = [];
    let energy = 0;
    for (let k = seg.startFrame; k < seg.endFrame; k++) {
      semis.push(track[k]);
      energy += frames[k].rms;
    }
    energy /= seg.endFrame - seg.startFrame;
    const m = median(semis);
    const midi = Math.round(m);
    notes.push({
      midi,
      start,
      duration,
      cents: Math.round((m - midi) * 100),
      energy,
    });
  }

  // Merge adjacent same-pitch notes separated by tiny gaps (breath flutter).
  // Threshold must stay well below a deliberate re-articulation (~25-50ms);
  // flutter-induced false splits are only a frame or two (~6-12ms).
  const merged: NoteEvent[] = [];
  for (const n of notes) {
    const prev = merged[merged.length - 1];
    if (prev && prev.midi === n.midi && n.start - (prev.start + prev.duration) < 0.015) {
      prev.duration = n.start + n.duration - prev.start;
      prev.energy = Math.max(prev.energy, n.energy);
    } else {
      merged.push({ ...n });
    }
  }
  return merged;
}
