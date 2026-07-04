import { describe, expect, it } from "vitest";
import { defaultYinOptions, pitchTrack, yinFrame } from "../src/dsp/yin";
import { midiToHz } from "../src/dsp/types";

function sine(hz: number, sampleRate: number, seconds: number): Float32Array {
  const out = new Float32Array(Math.floor(sampleRate * seconds));
  for (let i = 0; i < out.length; i++) out[i] = Math.sin((2 * Math.PI * hz * i) / sampleRate);
  return out;
}

describe("yinFrame", () => {
  const sr = 44100;
  const opts = defaultYinOptions(sr);

  it.each([110, 220, 261.63, 440, 880])("detects a %f Hz sine within 1 cent", (hz) => {
    const buf = sine(hz, sr, 0.1);
    const res = yinFrame(buf.subarray(0, opts.frameSize), opts);
    const cents = 1200 * Math.log2(res.hz / hz);
    expect(Math.abs(cents)).toBeLessThan(1);
    expect(res.confidence).toBeGreaterThan(0.9);
  });

  it("detects pitch with harmonics (hum-like timbre)", () => {
    const hz = midiToHz(60); // middle C
    const buf = new Float32Array(opts.frameSize);
    for (let i = 0; i < buf.length; i++) {
      const ph = (2 * Math.PI * hz * i) / sr;
      buf[i] = Math.sin(ph) + 0.25 * Math.sin(2 * ph) + 0.08 * Math.sin(3 * ph);
    }
    const res = yinFrame(buf, opts);
    const cents = 1200 * Math.log2(res.hz / hz);
    expect(Math.abs(cents)).toBeLessThan(3);
  });

  it("reports unvoiced for white noise", () => {
    let seed = 1;
    const buf = new Float32Array(opts.frameSize);
    for (let i = 0; i < buf.length; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      buf[i] = (seed / 0x7fffffff) * 2 - 1;
    }
    const res = yinFrame(buf, opts);
    // Either explicitly unvoiced or extremely low confidence.
    expect(res.hz === 0 || res.confidence < 0.6).toBe(true);
  });

  it("reports unvoiced for silence", () => {
    const res = yinFrame(new Float32Array(opts.frameSize), opts);
    expect(res.hz).toBe(0);
  });
});

describe("pitchTrack", () => {
  it("tracks a pitch change across frames", () => {
    const sr = 44100;
    const opts = defaultYinOptions(sr);
    const a = sine(220, sr, 0.5);
    const b = sine(330, sr, 0.5);
    const both = new Float32Array(a.length + b.length);
    both.set(a);
    both.set(b, a.length);
    const frames = pitchTrack(both, opts);
    const early = frames[Math.floor(frames.length * 0.2)];
    const late = frames[Math.floor(frames.length * 0.8)];
    expect(early.hz).toBeCloseTo(220, 0);
    expect(late.hz).toBeCloseTo(330, 0);
  });
});
