import { describe, expect, it } from "vitest";
import { decodeMidi, encodeMidi } from "../src/exporters/midi";
import { decodeWav, encodeWav } from "../src/exporters/wav";
import type { QuantizedNote } from "../src/dsp/types";

describe("MIDI writer", () => {
  const notes: QuantizedNote[] = [
    { midi: 60, startBeats: 0, durationBeats: 1, velocity: 100 },
    { midi: 62, startBeats: 1, durationBeats: 0.5, velocity: 90 },
    { midi: 64, startBeats: 1.5, durationBeats: 2, velocity: 127 },
    { midi: 60, startBeats: 4, durationBeats: 0.25, velocity: 20 },
  ];

  it("round-trips notes and tempo exactly", () => {
    const bytes = encodeMidi(notes, 96);
    const decoded = decodeMidi(bytes);
    expect(decoded.bpm).toBe(96);
    expect(decoded.notes).toEqual(notes);
  });

  it("starts with a valid SMF header", () => {
    const bytes = encodeMidi(notes, 120);
    expect([...bytes.slice(0, 4)]).toEqual([0x4d, 0x54, 0x68, 0x64]); // MThd
    expect(bytes[9]).toBe(0); // format 0
  });

  it("handles an empty transcription", () => {
    const decoded = decodeMidi(encodeMidi([], 120));
    expect(decoded.notes).toEqual([]);
  });
});

describe("WAV codec", () => {
  it("round-trips samples within 16-bit precision", () => {
    const sr = 22050;
    const samples = new Float32Array(1000);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.sin(i / 10) * 0.8;
    const decoded = decodeWav(encodeWav(samples, sr));
    expect(decoded.sampleRate).toBe(sr);
    expect(decoded.samples.length).toBe(samples.length);
    for (let i = 0; i < samples.length; i += 100) {
      expect(decoded.samples[i]).toBeCloseTo(samples[i], 3);
    }
  });
});
