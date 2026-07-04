/** Generates hum WAV fixtures before the e2e suite runs. */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { ALL_MELODIES, DEFAULT_HUM, synthesizeHum } from "../src/fixtures/hum";
import { encodeWav } from "../src/exporters/wav";

export default function globalSetup(): void {
  const outDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
  mkdirSync(outDir, { recursive: true });
  for (const melody of ALL_MELODIES) {
    const samples = synthesizeHum(melody, DEFAULT_HUM);
    writeFileSync(join(outDir, `${melody.name}.wav`), encodeWav(samples, DEFAULT_HUM.sampleRate));
    writeFileSync(
      join(outDir, `${melody.name}.json`),
      JSON.stringify({ bpm: melody.bpm, midi: melody.notes.map((n) => n.midi) }),
    );
  }
}
