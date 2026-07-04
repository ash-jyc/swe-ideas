/** WebAudio playback of a transcription: soft pluck-ish synth + optional render to PCM. */

import type { QuantizedNote } from "../dsp/types";
import { midiToHz } from "../dsp/types";

function scheduleNote(
  ctx: BaseAudioContext,
  dest: AudioNode,
  note: QuantizedNote,
  startSec: number,
  durSec: number,
): void {
  const osc = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.value = midiToHz(note.midi);
  osc2.type = "sine";
  osc2.frequency.value = midiToHz(note.midi) * 2;

  const g2 = ctx.createGain();
  g2.gain.value = 0.12;
  osc2.connect(g2);
  g2.connect(gain);
  osc.connect(gain);
  gain.connect(dest);

  const amp = (note.velocity / 127) * 0.25;
  const attack = 0.012;
  const release = Math.min(0.12, durSec * 0.3);
  gain.gain.setValueAtTime(0, startSec);
  gain.gain.linearRampToValueAtTime(amp, startSec + attack);
  gain.gain.setValueAtTime(amp, startSec + Math.max(attack, durSec - release));
  gain.gain.linearRampToValueAtTime(0.0001, startSec + durSec);

  osc.start(startSec);
  osc.stop(startSec + durSec + 0.05);
  osc2.start(startSec);
  osc2.stop(startSec + durSec + 0.05);
}

export interface PlaybackHandle {
  stop(): void;
  /** Resolves when playback finishes naturally or is stopped. */
  done: Promise<void>;
}

export function play(notes: QuantizedNote[], bpm: number): PlaybackHandle {
  const ctx = new AudioContext();
  const beatSec = 60 / bpm;
  const t0 = ctx.currentTime + 0.08;
  let end = t0;
  for (const n of notes) {
    const start = t0 + n.startBeats * beatSec;
    const dur = Math.max(0.09, n.durationBeats * beatSec * 0.95);
    scheduleNote(ctx, ctx.destination, n, start, dur);
    end = Math.max(end, start + dur);
  }
  let resolve!: () => void;
  const done = new Promise<void>((r) => (resolve = r));
  const timer = setTimeout(() => {
    void ctx.close();
    resolve();
  }, (end - ctx.currentTime + 0.2) * 1000);
  return {
    stop() {
      clearTimeout(timer);
      void ctx.close();
      resolve();
    },
    done,
  };
}

/** Render the same synth offline to mono PCM (for WAV export). */
export async function renderToPcm(
  notes: QuantizedNote[],
  bpm: number,
  sampleRate = 44100,
): Promise<{ samples: Float32Array; sampleRate: number }> {
  const beatSec = 60 / bpm;
  const totalBeats = notes.reduce((m, n) => Math.max(m, n.startBeats + n.durationBeats), 0);
  const seconds = totalBeats * beatSec + 0.5;
  const ctx = new OfflineAudioContext(1, Math.ceil(seconds * sampleRate), sampleRate);
  for (const n of notes) {
    const start = 0.05 + n.startBeats * beatSec;
    const dur = Math.max(0.09, n.durationBeats * beatSec * 0.95);
    scheduleNote(ctx, ctx.destination, n, start, dur);
  }
  const buf = await ctx.startRendering();
  return { samples: buf.getChannelData(0).slice(), sampleRate };
}
