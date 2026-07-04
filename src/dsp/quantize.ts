/**
 * Tempo estimation and rhythmic quantization.
 *
 * Tempo: score a range of candidate BPMs by how well note onsets align to
 * the candidate's sixteenth-note grid (with the grid phase-anchored at the
 * first onset), preferring candidates in a comfortable 60-180 BPM band.
 */

import type { NoteEvent, QuantizedNote } from "./types";

export interface QuantizeOptions {
  /** Grid resolution in fractions of a beat (0.25 = sixteenth notes). */
  gridBeats: number;
  bpmMin: number;
  bpmMax: number;
}

export const DEFAULT_QUANTIZE_OPTIONS: QuantizeOptions = {
  gridBeats: 0.25,
  bpmMin: 50,
  bpmMax: 200,
};

/** How badly onsets miss the grid at a given BPM (0 = perfect alignment). */
function gridError(onsets: number[], durations: number[], bpm: number, gridBeats: number): number {
  const beatSec = 60 / bpm;
  const gridSec = beatSec * gridBeats;
  const t0 = onsets[0];
  let err = 0;
  for (let i = 0; i < onsets.length; i++) {
    const relOnset = (onsets[i] - t0) / gridSec;
    err += Math.abs(relOnset - Math.round(relOnset));
    const relDur = durations[i] / gridSec;
    err += 0.5 * Math.abs(relDur - Math.max(1, Math.round(relDur)));
  }
  return err / onsets.length;
}

/** Estimate tempo from note events. Returns BPM. */
export function estimateBpm(
  notes: NoteEvent[],
  opts: QuantizeOptions = DEFAULT_QUANTIZE_OPTIONS,
): number {
  if (notes.length < 2) return 100;
  const onsets = notes.map((n) => n.start);
  const durations = notes.map((n) => n.duration);

  let bestBpm = 100;
  let bestScore = Infinity;
  for (let bpm = opts.bpmMin; bpm <= opts.bpmMax; bpm += 1) {
    let score = gridError(onsets, durations, bpm, opts.gridBeats);
    // Prefer moderate tempos: a melody that fits at 80 also fits at 160
    // with every note twice as subdivided, so nudge toward the middle.
    const center = 110;
    score += Math.abs(bpm - center) * 0.0004;
    if (score < bestScore) {
      bestScore = score;
      bestBpm = bpm;
    }
  }
  return bestBpm;
}

/** Snap note events to the grid of the given BPM. */
export function quantizeNotes(
  notes: NoteEvent[],
  bpm: number,
  opts: QuantizeOptions = DEFAULT_QUANTIZE_OPTIONS,
): QuantizedNote[] {
  if (notes.length === 0) return [];
  const beatSec = 60 / bpm;
  const gridSec = beatSec * opts.gridBeats;
  const t0 = notes[0].start;
  const peakEnergy = Math.max(...notes.map((n) => n.energy), 1e-9);

  const out: QuantizedNote[] = [];
  for (const n of notes) {
    const startSteps = Math.round((n.start - t0) / gridSec);
    const durSteps = Math.max(1, Math.round(n.duration / gridSec));
    const velocity = Math.max(20, Math.min(127, Math.round((n.energy / peakEnergy) * 110 + 17)));
    out.push({
      midi: n.midi,
      startBeats: startSteps * opts.gridBeats,
      durationBeats: durSteps * opts.gridBeats,
      velocity,
    });
  }

  // Resolve overlaps introduced by rounding: truncate to the next onset.
  for (let i = 0; i < out.length - 1; i++) {
    const end = out[i].startBeats + out[i].durationBeats;
    if (end > out[i + 1].startBeats) {
      out[i].durationBeats = Math.max(opts.gridBeats, out[i + 1].startBeats - out[i].startBeats);
    }
  }
  // Drop notes that ended up fully swallowed (same start as successor).
  return out.filter(
    (n, i) => i === out.length - 1 || n.startBeats < out[i + 1].startBeats || n.midi !== out[i + 1].midi,
  );
}
