import "./ui/style.css";

import { decodeAudioFile, startRecording, type Recorder } from "./audio/capture";
import { transcribe } from "./dsp/transcribe";
import { estimateKey } from "./dsp/key";
import { segmentNotes } from "./dsp/segment";
import { pitchTrack, defaultYinOptions, yinFrame } from "./dsp/yin";
import { quantizeNotes } from "./dsp/quantize";
import { midiToName, hzToMidiFloat, type NoteEvent, type QuantizedNote } from "./dsp/types";
import { encodeMidi } from "./exporters/midi";
import { encodeWav } from "./exporters/wav";
import { renderScore } from "./score/notation";
import { PianoRoll } from "./score/pianoroll";
import { play, renderToPcm, type PlaybackHandle } from "./synth/playback";

const $ = <T extends HTMLElement>(sel: string): T => {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`missing element ${sel}`);
  return el;
};

const recordBtn = $<HTMLButtonElement>("#record-btn");
const fileInput = $<HTMLInputElement>("#file-input");
const result = $<HTMLElement>("#result");
const metaKey = $<HTMLElement>("#meta-key");
const bpmInput = $<HTMLInputElement>("#bpm-input");
const quantizeToggle = $<HTMLInputElement>("#quantize-toggle");
const playBtn = $<HTMLButtonElement>("#play-btn");
const midiBtn = $<HTMLButtonElement>("#midi-btn");
const wavBtn = $<HTMLButtonElement>("#wav-btn");
const scoreEl = $<HTMLElement>("#score");
const noteListEl = $<HTMLElement>("#note-list");
const livePitch = $<HTMLElement>("#live-pitch");
const liveNote = $<HTMLElement>("#live-note");
const liveTrace = $<HTMLCanvasElement>("#live-trace");

interface AppState {
  /** Unquantized events from the last analysis (source of truth for re-quantizing). */
  events: NoteEvent[];
  notes: QuantizedNote[];
  bpm: number;
  keyName: string;
  keyAccidentals: number;
}

let state: AppState | null = null;
let recorder: Recorder | null = null;
let playback: PlaybackHandle | null = null;

const roll = new PianoRoll($("#pianoroll"), (notes) => {
  if (!state) return;
  state.notes = notes;
  const key = estimateKey(notes);
  state.keyName = key.name;
  state.keyAccidentals = key.accidentals;
  renderAll({ skipRoll: true });
});

function renderAll(opts: { skipRoll?: boolean } = {}): void {
  if (!state) return;
  // Test hook: lets e2e tests read the current transcription.
  (window as unknown as { __earworm?: unknown }).__earworm = {
    notes: state.notes,
    bpm: state.bpm,
    key: state.keyName,
  };
  result.hidden = false;
  metaKey.textContent = state.keyName;
  bpmInput.value = String(state.bpm);
  renderScore(scoreEl, state.notes, state.keyAccidentals);
  if (!opts.skipRoll) roll.setNotes(state.notes);
  noteListEl.textContent = state.notes.map((n) => midiToName(n.midi, state!.keyAccidentals < 0)).join(" · ");
}

function analyze(samples: Float32Array, sampleRate: number): void {
  const t = transcribe(samples, sampleRate);
  const frames = pitchTrack(samples, defaultYinOptions(sampleRate));
  state = {
    events: segmentNotes(frames),
    notes: t.notes,
    bpm: t.bpm,
    keyName: t.key,
    keyAccidentals: t.keyAccidentals,
  };
  renderAll();
  if (t.notes.length === 0) {
    noteListEl.textContent = "No notes detected — try humming louder, closer to the mic.";
  }
}

function requantize(): void {
  if (!state) return;
  const bpm = Number(bpmInput.value) || state.bpm;
  state.bpm = bpm;
  if (quantizeToggle.checked) {
    state.notes = quantizeNotes(state.events, bpm);
  } else {
    const beatSec = 60 / bpm;
    const t0 = state.events[0]?.start ?? 0;
    const peak = Math.max(...state.events.map((e) => e.energy), 1e-9);
    state.notes = state.events.map((e) => ({
      midi: e.midi,
      startBeats: (e.start - t0) / beatSec,
      durationBeats: e.duration / beatSec,
      velocity: Math.max(20, Math.min(127, Math.round((e.energy / peak) * 110 + 17))),
    }));
  }
  const key = estimateKey(state.notes);
  state.keyName = key.name;
  state.keyAccidentals = key.accidentals;
  renderAll();
}

bpmInput.addEventListener("change", requantize);
quantizeToggle.addEventListener("change", requantize);

// --- Recording with live pitch feedback -----------------------------------

const liveHistory: number[] = [];

function drawLiveTrace(): void {
  const ctx = liveTrace.getContext("2d");
  if (!ctx) return;
  const { width: w, height: h } = liveTrace;
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = "#e8a33d";
  ctx.lineWidth = 2;
  ctx.beginPath();
  let started = false;
  liveHistory.forEach((semi, i) => {
    if (Number.isNaN(semi)) {
      started = false;
      return;
    }
    const x = (i / 200) * w;
    const y = h - ((semi - 40) / 45) * h;
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

recordBtn.addEventListener("click", async () => {
  if (recorder) {
    const rec = recorder;
    recorder = null;
    recordBtn.textContent = "● Record";
    recordBtn.classList.remove("recording");
    livePitch.hidden = true;
    const { samples, sampleRate } = await rec.stop();
    analyze(samples, sampleRate);
    return;
  }
  try {
    recorder = await startRecording();
  } catch {
    liveNote.textContent = "mic unavailable";
    return;
  }
  liveHistory.length = 0;
  livePitch.hidden = false;
  recordBtn.textContent = "■ Stop";
  recordBtn.classList.add("recording");
  recorder.onChunk = (chunk, sampleRate) => {
    const opts = { ...defaultYinOptions(sampleRate), frameSize: Math.min(2048, chunk.length) };
    const { hz, confidence } = yinFrame(chunk, opts);
    const voiced = hz > 0 && confidence > 0.6;
    liveHistory.push(voiced ? hzToMidiFloat(hz) : NaN);
    if (liveHistory.length > 200) liveHistory.shift();
    liveNote.textContent = voiced ? midiToName(Math.round(hzToMidiFloat(hz))) : "—";
    drawLiveTrace();
  };
});

// --- File upload / drop ----------------------------------------------------

fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  const { samples, sampleRate } = await decodeAudioFile(file);
  analyze(samples, sampleRate);
});

document.body.addEventListener("dragover", (e) => e.preventDefault());
document.body.addEventListener("drop", async (e) => {
  e.preventDefault();
  const file = e.dataTransfer?.files?.[0];
  if (!file) return;
  const { samples, sampleRate } = await decodeAudioFile(file);
  analyze(samples, sampleRate);
});

// --- Playback & export -----------------------------------------------------

playBtn.addEventListener("click", () => {
  if (!state) return;
  if (playback) {
    playback.stop();
    playback = null;
    playBtn.textContent = "▶ Play";
    return;
  }
  playBtn.textContent = "■ Stop";
  playback = play(state.notes, state.bpm);
  void playback.done.then(() => {
    playback = null;
    playBtn.textContent = "▶ Play";
  });
});

function download(bytes: Uint8Array, filename: string, type: string): void {
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

midiBtn.addEventListener("click", () => {
  if (!state) return;
  download(encodeMidi(state.notes, state.bpm), "earworm.mid", "audio/midi");
});

wavBtn.addEventListener("click", async () => {
  if (!state) return;
  const { samples, sampleRate } = await renderToPcm(state.notes, state.bpm);
  download(encodeWav(samples, sampleRate), "earworm.wav", "audio/wav");
});
