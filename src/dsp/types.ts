/** A single frame of pitch analysis. */
export interface PitchFrame {
  /** Frame start time in seconds. */
  time: number;
  /** Detected fundamental frequency in Hz, or 0 if unvoiced. */
  hz: number;
  /** Detection confidence in [0, 1] (1 = very periodic). */
  confidence: number;
  /** RMS energy of the frame. */
  rms: number;
}

/** A detected note event, in real (unquantized) time. */
export interface NoteEvent {
  /** MIDI note number (60 = middle C). */
  midi: number;
  /** Start time in seconds. */
  start: number;
  /** Duration in seconds. */
  duration: number;
  /** Median deviation from equal temperament, in cents. */
  cents: number;
  /** Mean RMS over the note, usable as velocity proxy. */
  energy: number;
}

/** A note snapped to a rhythmic grid. */
export interface QuantizedNote {
  midi: number;
  /** Start position in beats from the beginning. */
  startBeats: number;
  /** Duration in beats (minimum one grid step). */
  durationBeats: number;
  /** MIDI velocity 1-127. */
  velocity: number;
}

export interface Transcription {
  notes: QuantizedNote[];
  bpm: number;
  /** e.g. "C major" / "A minor". */
  key: string;
  /** Number of sharps (+) or flats (-) in the key signature. */
  keyAccidentals: number;
}

export const A4_HZ = 440;
export const A4_MIDI = 69;

export function hzToMidiFloat(hz: number): number {
  return A4_MIDI + 12 * Math.log2(hz / A4_HZ);
}

export function midiToHz(midi: number): number {
  return A4_HZ * Math.pow(2, (midi - A4_MIDI) / 12);
}

const NOTE_NAMES_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NOTE_NAMES_FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

export function midiToName(midi: number, useFlats = false): string {
  const names = useFlats ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP;
  const octave = Math.floor(midi / 12) - 1;
  return `${names[((midi % 12) + 12) % 12]}${octave}`;
}
