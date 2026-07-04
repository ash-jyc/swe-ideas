/**
 * Synthesizes hum-like audio for known melodies — the ground truth used by
 * unit tests and e2e tests. Deliberately imperfect: vibrato, slow pitch
 * drift, breathy noise, soft attacks, and slightly loose timing, so the
 * DSP is exercised against something shaped like a real human hum.
 */

import { midiToHz } from "../dsp/types";

export interface MelodyNote {
  midi: number;
  /** Duration in beats. */
  beats: number;
  /** Rest before this note, in beats. */
  restBefore?: number;
}

export interface Melody {
  name: string;
  bpm: number;
  notes: MelodyNote[];
}

/** C major scale ascending, one octave. */
export const SCALE_C_MAJOR: Melody = {
  name: "c-major-scale",
  bpm: 100,
  notes: [60, 62, 64, 65, 67, 69, 71, 72].map((midi) => ({ midi, beats: 1 })),
};

/** Opening phrase of "Happy Birthday" in F major (starts on C4). */
export const HAPPY_BIRTHDAY: Melody = {
  name: "happy-birthday",
  bpm: 110,
  notes: [
    { midi: 60, beats: 0.75 },
    { midi: 60, beats: 0.25 },
    { midi: 62, beats: 1 },
    { midi: 60, beats: 1 },
    { midi: 65, beats: 1 },
    { midi: 64, beats: 2 },
  ],
};

/** "Twinkle Twinkle" first phrase in C. */
export const TWINKLE: Melody = {
  name: "twinkle",
  bpm: 90,
  notes: [
    { midi: 60, beats: 1 },
    { midi: 60, beats: 1 },
    { midi: 67, beats: 1 },
    { midi: 67, beats: 1 },
    { midi: 69, beats: 1 },
    { midi: 69, beats: 1 },
    { midi: 67, beats: 2 },
  ],
};

export const ALL_MELODIES: Melody[] = [SCALE_C_MAJOR, HAPPY_BIRTHDAY, TWINKLE];

export interface HumOptions {
  sampleRate: number;
  /** Vibrato depth in semitones. */
  vibratoSemitones: number;
  vibratoHz: number;
  /** Random slow drift depth in semitones. */
  driftSemitones: number;
  /** Breath-noise level relative to tone. */
  noiseLevel: number;
  /** Attack/release time in seconds. */
  attack: number;
  release: number;
  /** Fraction of each note's tail left silent (articulation gap). */
  gap: number;
  /** Deterministic seed. */
  seed: number;
}

export const DEFAULT_HUM: HumOptions = {
  sampleRate: 44100,
  vibratoSemitones: 0.18,
  vibratoHz: 5.2,
  driftSemitones: 0.12,
  noiseLevel: 0.02,
  attack: 0.035,
  release: 0.05,
  gap: 0.08,
  seed: 42,
};

/** Small deterministic PRNG (mulberry32). */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function synthesizeHum(melody: Melody, opts: HumOptions = DEFAULT_HUM): Float32Array {
  const { sampleRate } = opts;
  const rng = makeRng(opts.seed);
  const beatSec = 60 / melody.bpm;

  const totalBeats = melody.notes.reduce((s, n) => s + n.beats + (n.restBefore ?? 0), 0);
  const totalSec = totalBeats * beatSec + 0.5;
  const out = new Float32Array(Math.ceil(totalSec * sampleRate));

  let cursor = 0.15; // lead-in silence
  for (const note of melody.notes) {
    cursor += (note.restBefore ?? 0) * beatSec;
    const noteSec = note.beats * beatSec;
    const soundSec = noteSec * (1 - opts.gap);
    // Slightly loose timing, like a human.
    const startJitter = (rng() - 0.5) * 0.02;
    const start = Math.max(0, cursor + startJitter);
    const startSample = Math.floor(start * sampleRate);
    const numSamples = Math.floor(soundSec * sampleRate);

    const baseHz = midiToHz(note.midi);
    const vibPhase = rng() * Math.PI * 2;
    const driftDir = (rng() - 0.5) * 2 * opts.driftSemitones;

    let phase = 0;
    for (let i = 0; i < numSamples && startSample + i < out.length; i++) {
      const t = i / sampleRate;
      const progress = i / numSamples;
      // Pitch modulation: vibrato + slow drift settling toward the target.
      const vib = opts.vibratoSemitones * Math.sin(2 * Math.PI * opts.vibratoHz * t + vibPhase);
      const drift = driftDir * (1 - progress) * Math.exp(-3 * progress);
      const hz = baseHz * Math.pow(2, (vib + drift) / 12);
      phase += (2 * Math.PI * hz) / sampleRate;

      // Hum timbre: strong fundamental + soft low harmonics.
      let s =
        Math.sin(phase) + 0.25 * Math.sin(2 * phase) + 0.08 * Math.sin(3 * phase);

      // Envelope.
      const secIn = t;
      const secLeft = soundSec - t;
      let env = 1;
      if (secIn < opts.attack) env *= secIn / opts.attack;
      if (secLeft < opts.release) env *= Math.max(0, secLeft / opts.release);

      // Breath noise, slightly stronger during attack.
      const noise = (rng() * 2 - 1) * opts.noiseLevel * (1 + (secIn < opts.attack ? 1.5 : 0));

      out[startSample + i] += (s * 0.28 + noise) * env;
    }
    cursor += noteSec;
  }
  return out;
}
