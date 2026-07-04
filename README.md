# 🎵 earworm

**Hum a melody, get real sheet music.** For the song stuck in your head that doesn't exist yet.

Record yourself humming (or drop in an audio file) and earworm turns it into engraved notation, an editable piano roll, instant playback, and a downloadable MIDI file — entirely in your browser. No account, no server, no AI API: your audio never leaves the page.

![earworm screenshot](docs/screenshot.png)

## Features

- **Live pitch feedback** while you record — see the note you're humming in real time.
- **Hum-tolerant transcription**: handles vibrato, pitch drift, breathy attacks, and repeated notes.
- **Engraved notation** (VexFlow) with key signature, time signature, rests, dotted rhythms, and ties.
- **Editable piano roll**: drag notes up/down to fix pitch, drag the right edge to change length, double-click to delete — the score re-renders live.
- **Tempo control**: auto-estimated BPM you can override; grid snapping can be toggled off.
- **Key detection** via Krumhansl-Schmuckler profile correlation.
- **Export** to standard MIDI, synthesized WAV, or just play it back in the browser.

## How it works

All DSP is written from scratch in TypeScript (`src/dsp/`):

1. **Pitch tracking** — the [YIN](http://audition.ens.fr/adc/pdf/2002_JASA_YIN.pdf) algorithm (difference function → cumulative mean normalized difference → absolute threshold → parabolic interpolation), tuned for the human humming range. Energy is measured at hop resolution so short articulation gaps between repeated notes survive the long pitch window.
2. **Note segmentation** — confidence/energy gating, median filtering, octave-jump correction, split-on-sustained-pitch-change, and merging of flutter-induced false splits.
3. **Tempo & quantization** — grid-alignment scoring across candidate BPMs, then snap to sixteenth-note grid.
4. **Key estimation** — duration-weighted pitch-class histogram correlated against the 24 Krumhansl-Kessler key profiles.

The MIDI writer (SMF type 0), WAV codec, and synth are also dependency-free; the only runtime dependency is VexFlow for engraving.

## Run it

```bash
npm install
npm run dev        # → http://localhost:5173
```

## Test it

The test suite verifies the whole pipeline against synthesized humming — deliberately imperfect audio (vibrato, drift, breath noise, loose timing) for melodies with known ground truth:

```bash
npm test           # vitest: DSP units + exact melody recovery + MIDI round-trip
npm run test:e2e   # playwright: file upload, live-mic recording, MIDI download,
                   # BPM requantize, score rendering — in a real browser
```

If your environment pre-installs Chromium outside Playwright's registry, point the tests at it: `EARWORM_CHROMIUM=/path/to/chrome npm run test:e2e`.

## Project structure

```
src/dsp/         yin.ts, segment.ts, quantize.ts, key.ts, transcribe.ts
src/exporters/   midi.ts (SMF writer + parser), wav.ts
src/score/       notation.ts (VexFlow), pianoroll.ts (canvas editor)
src/synth/       playback.ts (WebAudio synth, live + offline render)
src/audio/       capture.ts (mic + file decode)
src/fixtures/    hum.ts (deterministic hum synthesizer for tests)
tests/           vitest unit + pipeline tests
e2e/             Playwright end-to-end tests
```

---

Born from a list of 80 project ideas — this was #25: *"Hum to musical notes? Ask for a certain vibe, put in notes…"*
