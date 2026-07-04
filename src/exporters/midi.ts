/**
 * Standard MIDI File (type 0) writer, plus a minimal parser used by tests
 * to round-trip what we wrote. No dependencies.
 */

import type { QuantizedNote } from "../dsp/types";

const TICKS_PER_BEAT = 480;

function vlq(value: number): number[] {
  // Variable-length quantity, MSB-first.
  const bytes = [value & 0x7f];
  let v = value >> 7;
  while (v > 0) {
    bytes.unshift((v & 0x7f) | 0x80);
    v >>= 7;
  }
  return bytes;
}

function u32(value: number): number[] {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

function u16(value: number): number[] {
  return [(value >>> 8) & 0xff, value & 0xff];
}

export function encodeMidi(notes: QuantizedNote[], bpm: number): Uint8Array {
  interface Ev {
    tick: number;
    /** 0 = note-off sorts before note-on at the same tick. */
    order: number;
    bytes: number[];
  }
  const events: Ev[] = [];
  for (const n of notes) {
    const onTick = Math.round(n.startBeats * TICKS_PER_BEAT);
    const offTick = Math.round((n.startBeats + n.durationBeats) * TICKS_PER_BEAT);
    events.push({ tick: onTick, order: 1, bytes: [0x90, n.midi & 0x7f, n.velocity & 0x7f] });
    events.push({ tick: Math.max(offTick, onTick + 1), order: 0, bytes: [0x80, n.midi & 0x7f, 0x40] });
  }
  events.sort((a, b) => a.tick - b.tick || a.order - b.order);

  const track: number[] = [];
  // Tempo meta event at tick 0.
  const usPerBeat = Math.round(60_000_000 / bpm);
  track.push(0x00, 0xff, 0x51, 0x03, (usPerBeat >> 16) & 0xff, (usPerBeat >> 8) & 0xff, usPerBeat & 0xff);

  let lastTick = 0;
  for (const ev of events) {
    track.push(...vlq(ev.tick - lastTick), ...ev.bytes);
    lastTick = ev.tick;
  }
  track.push(0x00, 0xff, 0x2f, 0x00); // end of track

  const bytes: number[] = [
    0x4d, 0x54, 0x68, 0x64, // MThd
    ...u32(6),
    ...u16(0), // format 0
    ...u16(1), // one track
    ...u16(TICKS_PER_BEAT),
    0x4d, 0x54, 0x72, 0x6b, // MTrk
    ...u32(track.length),
    ...track,
  ];
  return new Uint8Array(bytes);
}

/** Minimal SMF parser: returns notes and bpm. Only handles what encodeMidi emits. */
export function decodeMidi(data: Uint8Array): { notes: QuantizedNote[]; bpm: number } {
  let pos = 14; // skip MThd
  const division = (data[12] << 8) | data[13];
  pos += 4; // MTrk
  pos += 4; // track length
  let tick = 0;
  let bpm = 120;
  const active = new Map<number, { tick: number; velocity: number }>();
  const notes: QuantizedNote[] = [];

  const readVlq = (): number => {
    let v = 0;
    for (;;) {
      const b = data[pos++];
      v = (v << 7) | (b & 0x7f);
      if ((b & 0x80) === 0) return v;
    }
  };

  while (pos < data.length) {
    tick += readVlq();
    const status = data[pos++];
    if (status === 0xff) {
      const type = data[pos++];
      const len = readVlq();
      if (type === 0x51) {
        const us = (data[pos] << 16) | (data[pos + 1] << 8) | data[pos + 2];
        bpm = Math.round(60_000_000 / us);
      }
      pos += len;
      if (type === 0x2f) break;
    } else if ((status & 0xf0) === 0x90) {
      const midi = data[pos++];
      const velocity = data[pos++];
      active.set(midi, { tick, velocity });
    } else if ((status & 0xf0) === 0x80) {
      const midi = data[pos++];
      pos++; // release velocity
      const on = active.get(midi);
      if (on) {
        notes.push({
          midi,
          startBeats: on.tick / division,
          durationBeats: (tick - on.tick) / division,
          velocity: on.velocity,
        });
        active.delete(midi);
      }
    } else {
      throw new Error(`Unsupported MIDI status byte 0x${status.toString(16)}`);
    }
  }
  notes.sort((a, b) => a.startBeats - b.startBeats);
  return { notes, bpm };
}
