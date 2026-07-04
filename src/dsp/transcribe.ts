/** Top-level pipeline: mono PCM → Transcription. */

import type { Transcription } from "./types";
import { pitchTrack, defaultYinOptions } from "./yin";
import { segmentNotes, DEFAULT_SEGMENT_OPTIONS } from "./segment";
import { estimateBpm, quantizeNotes, DEFAULT_QUANTIZE_OPTIONS } from "./quantize";
import { estimateKey } from "./key";

export interface TranscribeOptions {
  /** Force a BPM instead of estimating. */
  bpm?: number;
  /** Disable grid snapping (still produces beats using estimated BPM). */
  quantize?: boolean;
}

export function transcribe(
  samples: Float32Array,
  sampleRate: number,
  opts: TranscribeOptions = {},
): Transcription {
  const frames = pitchTrack(samples, defaultYinOptions(sampleRate));
  const events = segmentNotes(frames, DEFAULT_SEGMENT_OPTIONS);
  const bpm = opts.bpm ?? estimateBpm(events);

  let notes;
  if (opts.quantize === false) {
    const beatSec = 60 / bpm;
    const t0 = events[0]?.start ?? 0;
    const peak = Math.max(...events.map((e) => e.energy), 1e-9);
    notes = events.map((e) => ({
      midi: e.midi,
      startBeats: (e.start - t0) / beatSec,
      durationBeats: e.duration / beatSec,
      velocity: Math.max(20, Math.min(127, Math.round((e.energy / peak) * 110 + 17))),
    }));
  } else {
    notes = quantizeNotes(events, bpm, DEFAULT_QUANTIZE_OPTIONS);
  }

  const key = estimateKey(notes);
  return { notes, bpm, key: key.name, keyAccidentals: key.accidentals };
}
