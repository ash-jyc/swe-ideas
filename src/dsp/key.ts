/**
 * Key estimation via Krumhansl-Schmuckler profile correlation.
 *
 * Build a duration-weighted pitch-class histogram from the notes, correlate
 * it against the 24 rotated major/minor key profiles, and pick the best.
 */

import type { QuantizedNote } from "./types";

// Krumhansl & Kessler (1982) probe-tone profiles.
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

const TONIC_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

/** Sharps (+) / flats (-) for each major tonic pitch class. */
const MAJOR_ACCIDENTALS = [0, 7, 2, -3, 4, -1, 6, 1, -4, 3, -2, 5];

function pearson(a: number[], b: number[]): number {
  const n = a.length;
  const ma = a.reduce((s, v) => s + v, 0) / n;
  const mb = b.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  const denom = Math.sqrt(da * db);
  return denom === 0 ? 0 : num / denom;
}

export interface KeyEstimate {
  /** e.g. "G major", "E minor". */
  name: string;
  /** Tonic pitch class 0-11. */
  tonic: number;
  mode: "major" | "minor";
  /** Sharps (+) or flats (-) in the key signature. */
  accidentals: number;
  /** Correlation score in [-1, 1]. */
  score: number;
}

export function estimateKey(notes: QuantizedNote[]): KeyEstimate {
  const histogram = new Array<number>(12).fill(0);
  for (const n of notes) {
    histogram[((n.midi % 12) + 12) % 12] += n.durationBeats;
  }

  let best: KeyEstimate = { name: "C major", tonic: 0, mode: "major", accidentals: 0, score: -2 };
  for (let tonic = 0; tonic < 12; tonic++) {
    const rotated = histogram.map((_, i) => histogram[(i + tonic) % 12]);
    const majScore = pearson(rotated, MAJOR_PROFILE);
    if (majScore > best.score) {
      best = {
        name: `${TONIC_NAMES[tonic]} major`,
        tonic,
        mode: "major",
        accidentals: MAJOR_ACCIDENTALS[tonic],
        score: majScore,
      };
    }
    const minScore = pearson(rotated, MINOR_PROFILE);
    if (minScore > best.score) {
      // Relative major is 3 semitones up; key signature matches it.
      const relMajor = (tonic + 3) % 12;
      best = {
        name: `${TONIC_NAMES[tonic]} minor`,
        tonic,
        mode: "minor",
        accidentals: MAJOR_ACCIDENTALS[relMajor],
        score: minScore,
      };
    }
  }
  return best;
}
