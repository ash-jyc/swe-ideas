/** Generates hum-like WAV fixtures with ground truth JSON into e2e/fixtures/. */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { ALL_MELODIES, DEFAULT_HUM, synthesizeHum } from "../src/fixtures/hum";
import { encodeWav } from "../src/exporters/wav";

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "e2e", "fixtures");
mkdirSync(outDir, { recursive: true });

for (const melody of ALL_MELODIES) {
  const samples = synthesizeHum(melody, DEFAULT_HUM);
  const wav = encodeWav(samples, DEFAULT_HUM.sampleRate);
  writeFileSync(join(outDir, `${melody.name}.wav`), wav);
  writeFileSync(
    join(outDir, `${melody.name}.json`),
    JSON.stringify(
      { bpm: melody.bpm, midi: melody.notes.map((n) => n.midi) },
      null,
      2,
    ),
  );
  console.log(`wrote ${melody.name}.wav (${(wav.length / 1024).toFixed(0)} KiB)`);
}
