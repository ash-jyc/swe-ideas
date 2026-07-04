import { describe, expect, it } from "vitest";
import { transcribe } from "../src/dsp/transcribe";
import { ALL_MELODIES, DEFAULT_HUM, synthesizeHum } from "../src/fixtures/hum";

describe("end-to-end transcription of synthetic hums", () => {
  it.each(ALL_MELODIES.map((m) => [m.name, m] as const))(
    "recovers the exact note sequence of %s",
    (_name, melody) => {
      const samples = synthesizeHum(melody, DEFAULT_HUM);
      const result = transcribe(samples, DEFAULT_HUM.sampleRate);
      expect(result.notes.map((n) => n.midi)).toEqual(melody.notes.map((n) => n.midi));
    },
  );

  it("is robust across different hum imperfection seeds", () => {
    const melody = ALL_MELODIES[0];
    for (const seed of [1, 7, 99, 1234]) {
      const samples = synthesizeHum(melody, { ...DEFAULT_HUM, seed });
      const result = transcribe(samples, DEFAULT_HUM.sampleRate);
      expect(result.notes.map((n) => n.midi)).toEqual(melody.notes.map((n) => n.midi));
    }
  });

  it("estimates a plausible tempo", () => {
    const melody = ALL_MELODIES[0]; // 100 BPM scale, quarter notes
    const samples = synthesizeHum(melody, DEFAULT_HUM);
    const result = transcribe(samples, DEFAULT_HUM.sampleRate);
    // Accept the true tempo or a metrical multiple/divisor of it.
    const ratio = result.bpm / melody.bpm;
    const nearest = [0.5, 1, 2].reduce((a, b) =>
      Math.abs(ratio - a) < Math.abs(ratio - b) ? a : b,
    );
    expect(Math.abs(ratio - nearest)).toBeLessThan(0.12);
  });

  it("estimates a sensible key for the C major scale", () => {
    const samples = synthesizeHum(ALL_MELODIES[0], DEFAULT_HUM);
    const result = transcribe(samples, DEFAULT_HUM.sampleRate);
    expect(["C major", "A minor", "G major"]).toContain(result.key);
  });

  it("returns no notes for silence", () => {
    const result = transcribe(new Float32Array(44100), 44100);
    expect(result.notes).toEqual([]);
  });
});
