import { describe, expect, it } from "vitest";
import { estimateBpm, quantizeNotes } from "../src/dsp/quantize";
import { estimateKey } from "../src/dsp/key";
import type { NoteEvent, QuantizedNote } from "../src/dsp/types";

function eventsAt(bpm: number, pattern: Array<{ midi: number; startBeats: number; beats: number }>): NoteEvent[] {
  const beatSec = 60 / bpm;
  return pattern.map((p) => ({
    midi: p.midi,
    start: p.startBeats * beatSec,
    duration: p.beats * beatSec * 0.92, // humans release early
    cents: 0,
    energy: 0.1,
  }));
}

describe("estimateBpm", () => {
  it("locks onto a metrically compatible tempo for a quarter-note pulse", () => {
    const events = eventsAt(100, [0, 1, 2, 3, 4, 5, 6, 7].map((b) => ({ midi: 60 + b, startBeats: b, beats: 1 })));
    const bpm = estimateBpm(events);
    const ratio = bpm / 100;
    const nearest = [0.5, 1, 2].reduce((a, b) => (Math.abs(ratio - a) < Math.abs(ratio - b) ? a : b));
    expect(Math.abs(ratio - nearest)).toBeLessThan(0.05);
  });
});

describe("quantizeNotes", () => {
  it("snaps slightly-off onsets to the grid", () => {
    const bpm = 120;
    const beatSec = 60 / bpm;
    const events: NoteEvent[] = [0, 1, 2, 3].map((b) => ({
      midi: 60,
      start: b * beatSec + (b % 2 ? 0.02 : -0.015), // jitter
      duration: beatSec * 0.9,
      cents: 0,
      energy: 0.1,
    }));
    const q = quantizeNotes(events, bpm);
    expect(q.map((n) => n.startBeats)).toEqual([0, 1, 2, 3]);
    expect(q.every((n) => n.durationBeats === 1)).toBe(true);
  });

  it("never produces overlapping notes", () => {
    const bpm = 100;
    const beatSec = 60 / bpm;
    const events: NoteEvent[] = [
      { midi: 60, start: 0, duration: beatSec * 1.4, cents: 0, energy: 0.1 },
      { midi: 62, start: beatSec, duration: beatSec, cents: 0, energy: 0.1 },
    ];
    const q = quantizeNotes(events, bpm);
    for (let i = 0; i < q.length - 1; i++) {
      expect(q[i].startBeats + q[i].durationBeats).toBeLessThanOrEqual(q[i + 1].startBeats);
    }
  });
});

describe("estimateKey", () => {
  it("identifies C major from a C major scale", () => {
    const notes: QuantizedNote[] = [60, 62, 64, 65, 67, 69, 71, 72].map((midi, i) => ({
      midi,
      startBeats: i,
      durationBeats: 1,
      velocity: 90,
    }));
    const key = estimateKey(notes);
    expect(["C major", "A minor"]).toContain(key.name);
    expect(key.accidentals).toBe(0);
  });

  it("identifies a sharp key", () => {
    // D major scale.
    const notes: QuantizedNote[] = [62, 64, 66, 67, 69, 71, 73, 74].map((midi, i) => ({
      midi,
      startBeats: i,
      durationBeats: 1,
      velocity: 90,
    }));
    const key = estimateKey(notes);
    expect(["D major", "B minor"]).toContain(key.name);
    expect(key.accidentals).toBe(2);
  });
});
