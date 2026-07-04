/**
 * YIN fundamental-frequency estimator.
 *
 * de Cheveigné & Kawahara (2002), "YIN, a fundamental frequency estimator
 * for speech and music" — steps 1-6: difference function, cumulative mean
 * normalized difference (CMND), absolute threshold, and parabolic
 * interpolation around the chosen lag.
 */

import type { PitchFrame } from "./types";

export interface YinOptions {
  sampleRate: number;
  /** Analysis window length in samples (power of two not required). */
  frameSize: number;
  /** Hop between successive frames in samples. */
  hopSize: number;
  /** CMND threshold; lower = stricter periodicity requirement. */
  threshold: number;
  /** Lowest f0 considered, Hz. */
  fMin: number;
  /** Highest f0 considered, Hz. */
  fMax: number;
}

/** Defaults tuned for human humming/singing. */
export function defaultYinOptions(sampleRate: number): YinOptions {
  return {
    sampleRate,
    frameSize: 2048,
    hopSize: 256,
    threshold: 0.15,
    fMin: 70,
    fMax: 1200,
  };
}

/**
 * Analyze one frame. Returns { hz, confidence } where hz = 0 means unvoiced.
 * `buf` must have at least `frameSize` samples; only the first frameSize are used.
 */
export function yinFrame(
  buf: Float32Array,
  opts: YinOptions,
): { hz: number; confidence: number } {
  const { sampleRate, frameSize, threshold, fMin, fMax } = opts;
  // Lag bounds. tauMax is limited so the difference function has at least
  // half a window of overlap to correlate.
  const tauMin = Math.max(2, Math.floor(sampleRate / fMax));
  const tauMax = Math.min(Math.floor(sampleRate / fMin), Math.floor(frameSize / 2));
  if (tauMin >= tauMax) return { hz: 0, confidence: 0 };

  const half = Math.floor(frameSize / 2);
  const diff = new Float32Array(tauMax + 1);
  for (let tau = tauMin; tau <= tauMax; tau++) {
    let sum = 0;
    for (let i = 0; i < half; i++) {
      const d = buf[i] - buf[i + tau];
      sum += d * d;
    }
    diff[tau] = sum;
  }

  // Cumulative mean normalized difference. Runs over the full lag range so
  // the normalization matches the paper (running mean from lag 1).
  const cmnd = new Float32Array(tauMax + 1);
  cmnd[0] = 1;
  let runningSum = 0;
  // Lags below tauMin still contribute to the running mean; compute their
  // raw difference lazily (cheap: only a handful of lags).
  for (let tau = 1; tau <= tauMax; tau++) {
    let d = diff[tau];
    if (tau < tauMin) {
      let sum = 0;
      for (let i = 0; i < half; i++) {
        const dd = buf[i] - buf[i + tau];
        sum += dd * dd;
      }
      d = sum;
    }
    runningSum += d;
    cmnd[tau] = runningSum === 0 ? 1 : (d * tau) / runningSum;
  }

  // Absolute threshold: first lag where CMND dips below threshold; then
  // descend to the local minimum that follows.
  let tau = -1;
  for (let t = tauMin; t <= tauMax; t++) {
    if (cmnd[t] < threshold) {
      let best = t;
      while (best + 1 <= tauMax && cmnd[best + 1] < cmnd[best]) best++;
      tau = best;
      break;
    }
  }
  if (tau === -1) {
    // No dip under threshold: pick global minimum but report low confidence.
    let bestVal = Infinity;
    for (let t = tauMin; t <= tauMax; t++) {
      if (cmnd[t] < bestVal) {
        bestVal = cmnd[t];
        tau = t;
      }
    }
    if (bestVal > 0.5) return { hz: 0, confidence: Math.max(0, 1 - bestVal) };
  }

  // Parabolic interpolation around tau for sub-sample lag precision.
  let betterTau = tau;
  if (tau > tauMin && tau < tauMax) {
    const s0 = cmnd[tau - 1];
    const s1 = cmnd[tau];
    const s2 = cmnd[tau + 1];
    const denom = 2 * (2 * s1 - s2 - s0);
    if (Math.abs(denom) > 1e-12) {
      betterTau = tau + (s2 - s0) / denom;
    }
  }

  const hz = opts.sampleRate / betterTau;
  const confidence = Math.max(0, Math.min(1, 1 - cmnd[tau]));
  if (hz < fMin || hz > fMax) return { hz: 0, confidence: 0 };
  return { hz, confidence };
}

/** Frame-by-frame pitch track of a mono signal. */
export function pitchTrack(samples: Float32Array, opts: YinOptions): PitchFrame[] {
  const { frameSize, hopSize, sampleRate } = opts;
  const frames: PitchFrame[] = [];
  // Pitch needs a long window, but energy must be measured with fine time
  // resolution or short articulation gaps (repeated notes) get smeared away.
  const rmsWindow = Math.min(2 * hopSize, frameSize);
  for (let start = 0; start + frameSize <= samples.length; start += hopSize) {
    const frame = samples.subarray(start, start + frameSize);
    let sumSq = 0;
    for (let i = 0; i < rmsWindow; i++) sumSq += frame[i] * frame[i];
    const rms = Math.sqrt(sumSq / rmsWindow);
    const { hz, confidence } = yinFrame(frame, opts);
    frames.push({ time: start / sampleRate, hz, confidence, rms });
  }
  return frames;
}
