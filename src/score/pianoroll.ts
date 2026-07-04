/**
 * Editable canvas piano roll.
 * Drag a note vertically to change pitch, drag its right edge to resize,
 * double-click to delete. Calls onChange after every edit.
 */

import type { QuantizedNote } from "../dsp/types";
import { midiToName } from "../dsp/types";

const CELL_H = 14;
const BEAT_W = 56;
const LABEL_W = 44;
const GRID_BEATS = 0.25;

export class PianoRoll {
  private notes: QuantizedNote[] = [];
  private canvas: HTMLCanvasElement;
  private onChange: (notes: QuantizedNote[]) => void;
  private drag:
    | { index: number; mode: "move" | "resize"; startY: number; startX: number; orig: QuantizedNote }
    | null = null;
  private lo = 48;
  private hi = 84;

  constructor(canvas: HTMLCanvasElement, onChange: (notes: QuantizedNote[]) => void) {
    this.canvas = canvas;
    this.onChange = onChange;
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("dblclick", this.onDoubleClick);
  }

  setNotes(notes: QuantizedNote[]): void {
    this.notes = notes.map((n) => ({ ...n }));
    const midis = notes.map((n) => n.midi);
    this.lo = Math.min(...(midis.length ? midis : [60])) - 4;
    this.hi = Math.max(...(midis.length ? midis : [72])) + 4;
    this.resize();
    this.draw();
  }

  getNotes(): QuantizedNote[] {
    return this.notes.map((n) => ({ ...n }));
  }

  private totalBeats(): number {
    const end = this.notes.reduce((m, n) => Math.max(m, n.startBeats + n.durationBeats), 4);
    return Math.ceil(end / 4) * 4;
  }

  private resize(): void {
    const cssW = LABEL_W + this.totalBeats() * BEAT_W;
    const cssH = (this.hi - this.lo + 1) * CELL_H;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = cssW * dpr;
    this.canvas.height = cssH * dpr;
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
  }

  private noteRect(n: QuantizedNote): { x: number; y: number; w: number; h: number } {
    return {
      x: LABEL_W + n.startBeats * BEAT_W,
      y: (this.hi - n.midi) * CELL_H,
      w: n.durationBeats * BEAT_W,
      h: CELL_H,
    };
  }

  private hitTest(px: number, py: number): { index: number; mode: "move" | "resize" } | null {
    for (let i = this.notes.length - 1; i >= 0; i--) {
      const r = this.noteRect(this.notes[i]);
      if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) {
        return { index: i, mode: px > r.x + r.w - 8 ? "resize" : "move" };
      }
    }
    return null;
  }

  private canvasPos(e: PointerEvent | MouseEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  private onPointerDown = (e: PointerEvent): void => {
    const { x, y } = this.canvasPos(e);
    const hit = this.hitTest(x, y);
    if (!hit) return;
    this.canvas.setPointerCapture(e.pointerId);
    this.drag = { ...hit, startX: x, startY: y, orig: { ...this.notes[hit.index] } };
  };

  private onPointerMove = (e: PointerEvent): void => {
    const { x, y } = this.canvasPos(e);
    if (!this.drag) {
      const hit = this.hitTest(x, y);
      this.canvas.style.cursor = hit ? (hit.mode === "resize" ? "ew-resize" : "grab") : "default";
      return;
    }
    const n = this.notes[this.drag.index];
    if (this.drag.mode === "move") {
      const dSemis = Math.round((this.drag.startY - y) / CELL_H);
      n.midi = Math.max(this.lo, Math.min(this.hi, this.drag.orig.midi + dSemis));
    } else {
      const dBeats = (x - this.drag.startX) / BEAT_W;
      const snapped = Math.round((this.drag.orig.durationBeats + dBeats) / GRID_BEATS) * GRID_BEATS;
      n.durationBeats = Math.max(GRID_BEATS, snapped);
    }
    this.draw();
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (!this.drag) return;
    this.canvas.releasePointerCapture(e.pointerId);
    const changed =
      this.notes[this.drag.index].midi !== this.drag.orig.midi ||
      this.notes[this.drag.index].durationBeats !== this.drag.orig.durationBeats;
    this.drag = null;
    if (changed) this.onChange(this.getNotes());
  };

  private onDoubleClick = (e: MouseEvent): void => {
    const { x, y } = this.canvasPos(e);
    const hit = this.hitTest(x, y);
    if (!hit) return;
    this.notes.splice(hit.index, 1);
    this.draw();
    this.onChange(this.getNotes());
  };

  draw(): void {
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = this.canvas.width / dpr;
    const h = this.canvas.height / dpr;
    const styles = getComputedStyle(this.canvas);
    const bg = styles.getPropertyValue("--roll-bg").trim() || "#14161d";
    const rowAlt = styles.getPropertyValue("--roll-row").trim() || "#191c25";
    const grid = styles.getPropertyValue("--roll-grid").trim() || "#262a37";
    const beatLine = styles.getPropertyValue("--roll-beat").trim() || "#333849";
    const noteFill = styles.getPropertyValue("--roll-note").trim() || "#e8a33d";
    const label = styles.getPropertyValue("--roll-label").trim() || "#8b93a7";

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Rows (highlight naturals vs sharps subtly) + labels for Cs.
    for (let midi = this.lo; midi <= this.hi; midi++) {
      const y = (this.hi - midi) * CELL_H;
      const pc = midi % 12;
      const isBlack = [1, 3, 6, 8, 10].includes(pc);
      ctx.fillStyle = isBlack ? bg : rowAlt;
      ctx.fillRect(LABEL_W, y, w - LABEL_W, CELL_H);
      if (pc === 0) {
        ctx.fillStyle = label;
        ctx.font = "10px system-ui, sans-serif";
        ctx.fillText(midiToName(midi), 6, y + CELL_H - 3);
      }
    }
    // Vertical grid.
    const beats = this.totalBeats();
    for (let b = 0; b <= beats; b += GRID_BEATS) {
      const x = LABEL_W + b * BEAT_W;
      ctx.strokeStyle = b % 4 === 0 ? beatLine : grid;
      ctx.lineWidth = b % 4 === 0 ? 1.5 : b % 1 === 0 ? 1 : 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    // Notes.
    for (const n of this.notes) {
      const r = this.noteRect(n);
      ctx.fillStyle = noteFill;
      ctx.beginPath();
      ctx.roundRect(r.x + 1, r.y + 1.5, Math.max(4, r.w - 2), r.h - 3, 3);
      ctx.fill();
    }
  }
}
