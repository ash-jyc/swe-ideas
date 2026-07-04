/**
 * Render a transcription as engraved notation via VexFlow.
 *
 * Assumes 4/4. Notes/rests are decomposed into standard symbols
 * (whole … sixteenth, with dotted variants), split at measure boundaries,
 * and tied across splits.
 */

import { Accidental, Dot, Formatter, Renderer, Stave, StaveNote, StaveTie, Voice } from "vexflow";
import type { QuantizedNote } from "../dsp/types";

const BEATS_PER_MEASURE = 4;
const EPS = 1e-6;

/** Map a duration in beats to VexFlow duration strings, largest-first. */
function decompose(beats: number): Array<{ duration: string; beats: number; dotted: boolean }> {
  const table: Array<{ duration: string; beats: number; dotted: boolean }> = [
    { duration: "w", beats: 4, dotted: false },
    { duration: "hd", beats: 3, dotted: true },
    { duration: "h", beats: 2, dotted: false },
    { duration: "qd", beats: 1.5, dotted: true },
    { duration: "q", beats: 1, dotted: false },
    { duration: "8d", beats: 0.75, dotted: true },
    { duration: "8", beats: 0.5, dotted: false },
    { duration: "16", beats: 0.25, dotted: false },
  ];
  const out: Array<{ duration: string; beats: number; dotted: boolean }> = [];
  let left = beats;
  while (left > EPS) {
    const pick = table.find((t) => t.beats <= left + EPS) ?? table[table.length - 1];
    out.push(pick);
    left -= pick.beats;
  }
  return out;
}

const SHARP_SPELLINGS = ["c", "c#", "d", "d#", "e", "f", "f#", "g", "g#", "a", "a#", "b"];
const FLAT_SPELLINGS = ["c", "db", "d", "eb", "e", "f", "gb", "g", "ab", "a", "bb", "b"];

function midiToVexKey(midi: number, useFlats: boolean): string {
  const spelling = (useFlats ? FLAT_SPELLINGS : SHARP_SPELLINGS)[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${spelling}/${octave}`;
}

/** VexFlow key-signature name from accidental count (+sharps / -flats). */
export function keySignatureName(accidentals: number): string {
  const sharpKeys = ["C", "G", "D", "A", "E", "B", "F#", "C#"];
  const flatKeys = ["C", "F", "Bb", "Eb", "Ab", "Db", "Gb", "Cb"];
  return accidentals >= 0 ? sharpKeys[accidentals] : flatKeys[-accidentals];
}

interface Symbol_ {
  vexDuration: string; // e.g. "q", "8d", "qr"
  dotted: boolean;
  isRest: boolean;
  midi: number; // for rests: ignored
  tieFromPrev: boolean;
}

/** Lay out notes+gaps into per-measure symbol lists. */
function layout(notes: QuantizedNote[]): Symbol_[][] {
  const totalBeats = notes.reduce((m, n) => Math.max(m, n.startBeats + n.durationBeats), 0);
  const measures: Symbol_[][] = [];
  const numMeasures = Math.max(1, Math.ceil((totalBeats - EPS) / BEATS_PER_MEASURE));
  for (let i = 0; i < numMeasures; i++) measures.push([]);

  const pushSpan = (startBeats: number, beats: number, midi: number, isRest: boolean) => {
    // Split the span at measure boundaries, then decompose each piece.
    let cursor = startBeats;
    let remaining = beats;
    let first = true;
    while (remaining > EPS) {
      const measureIdx = Math.floor(cursor / BEATS_PER_MEASURE + EPS);
      const boundary = (measureIdx + 1) * BEATS_PER_MEASURE;
      const piece = Math.min(remaining, boundary - cursor);
      for (const part of decompose(piece)) {
        measures[Math.min(measureIdx, measures.length - 1)].push({
          vexDuration: isRest ? `${part.duration.replace("d", "")}${part.dotted ? "d" : ""}r` : part.duration,
          dotted: part.dotted,
          isRest,
          midi,
          tieFromPrev: !isRest && !first,
        });
        first = false;
      }
      cursor += piece;
      remaining -= piece;
    }
  };

  let cursor = 0;
  for (const n of notes) {
    if (n.startBeats > cursor + EPS) pushSpan(cursor, n.startBeats - cursor, 0, true);
    pushSpan(n.startBeats, n.durationBeats, n.midi, false);
    cursor = Math.max(cursor, n.startBeats + n.durationBeats);
  }
  const end = numMeasures * BEATS_PER_MEASURE;
  if (end > cursor + EPS) pushSpan(cursor, end - cursor, 0, true);
  return measures;
}

export interface RenderOptions {
  measuresPerRow: number;
  measureWidth: number;
}

const DEFAULT_RENDER: RenderOptions = { measuresPerRow: 4, measureWidth: 240 };

/** Render into `container` (cleared first). Returns the number of measures drawn. */
export function renderScore(
  container: HTMLElement,
  notes: QuantizedNote[],
  keyAccidentals: number,
  opts: RenderOptions = DEFAULT_RENDER,
): number {
  container.innerHTML = "";
  const useFlats = keyAccidentals < 0;
  const measures = layout(notes);
  const keyName = keySignatureName(keyAccidentals);

  const rows = Math.ceil(measures.length / opts.measuresPerRow);
  const rowHeight = 120;
  const leftPad = 20;
  const width = leftPad * 2 + opts.measuresPerRow * opts.measureWidth + 60;
  const renderer = new Renderer(container as HTMLDivElement, Renderer.Backends.SVG);
  renderer.resize(width, rows * rowHeight + 40);
  const ctx = renderer.getContext();

  measures.forEach((symbols, mi) => {
    const row = Math.floor(mi / opts.measuresPerRow);
    const col = mi % opts.measuresPerRow;
    const isRowStart = col === 0;
    const x = leftPad + col * opts.measureWidth + (isRowStart ? 0 : 60);
    const y = 20 + row * rowHeight;
    const w = opts.measureWidth + (isRowStart ? 60 : 0);
    const stave = new Stave(x, y, w);
    if (isRowStart) {
      stave.addClef("treble").addKeySignature(keyName);
      if (mi === 0) stave.addTimeSignature("4/4");
    }
    stave.setContext(ctx).draw();

    if (symbols.length === 0) return;
    const staveNotes = symbols.map((s) => {
      const note = new StaveNote({
        keys: [s.isRest ? "b/4" : midiToVexKey(s.midi, useFlats)],
        duration: s.vexDuration,
        auto_stem: true,
      });
      if (s.dotted) Dot.buildAndAttach([note], { all: true });
      return note;
    });

    const voice = new Voice({ num_beats: BEATS_PER_MEASURE, beat_value: 4 });
    voice.setMode(Voice.Mode.SOFT);
    voice.addTickables(staveNotes);
    Accidental.applyAccidentals([voice], keyName);
    new Formatter().joinVoices([voice]).format([voice], w - (isRowStart ? 110 : 30));
    voice.draw(ctx, stave);

    symbols.forEach((s, i) => {
      if (s.tieFromPrev && i > 0) {
        new StaveTie({ first_note: staveNotes[i - 1], last_note: staveNotes[i] }).setContext(ctx).draw();
      }
    });
  });
  return measures.length;
}
