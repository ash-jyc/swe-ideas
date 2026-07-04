import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { decodeMidi } from "../src/exporters/midi";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

interface EarwormState {
  notes: Array<{ midi: number; startBeats: number; durationBeats: number; velocity: number }>;
  bpm: number;
  key: string;
}

function groundTruth(name: string): { bpm: number; midi: number[] } {
  return JSON.parse(readFileSync(join(fixturesDir, `${name}.json`), "utf8"));
}

async function uploadFixture(page: import("@playwright/test").Page, name: string): Promise<void> {
  await page.goto("/");
  await page.setInputFiles('[data-testid="file-input"]', join(fixturesDir, `${name}.wav`));
  await expect(page.locator("#result")).toBeVisible();
  await page.waitForFunction(() => (window as never as { __earworm?: EarwormState }).__earworm);
}

async function readState(page: import("@playwright/test").Page): Promise<EarwormState> {
  return page.evaluate(() => (window as never as { __earworm: EarwormState }).__earworm);
}

for (const name of ["c-major-scale", "happy-birthday", "twinkle"]) {
  test(`transcribes ${name} fixture to the exact note sequence`, async ({ page }) => {
    await uploadFixture(page, name);
    const state = await readState(page);
    expect(state.notes.map((n) => n.midi)).toEqual(groundTruth(name).midi);
    // The engraved score rendered real notation.
    const svg = page.locator('[data-testid="score"] svg');
    await expect(svg).toBeVisible();
    expect(await svg.locator(".vf-stavenote").count()).toBeGreaterThanOrEqual(state.notes.length);
  });
}

test("downloaded MIDI round-trips to the same notes", async ({ page }) => {
  await uploadFixture(page, "c-major-scale");
  const state = await readState(page);

  const downloadPromise = page.waitForEvent("download");
  await page.click('[data-testid="midi-btn"]');
  const download = await downloadPromise;
  const path = await download.path();
  const midi = decodeMidi(new Uint8Array(readFileSync(path!)));

  expect(midi.notes.map((n) => n.midi)).toEqual(state.notes.map((n) => n.midi));
  expect(midi.bpm).toBe(state.bpm);
});

test("changing BPM requantizes without losing notes", async ({ page }) => {
  await uploadFixture(page, "c-major-scale");
  const before = await readState(page);
  await page.fill('[data-testid="bpm-input"]', "60");
  await page.dispatchEvent('[data-testid="bpm-input"]', "change");
  const after = await readState(page);
  expect(after.bpm).toBe(60);
  expect(after.notes.map((n) => n.midi)).toEqual(before.notes.map((n) => n.midi));
});

test("shows the estimated key", async ({ page }) => {
  await uploadFixture(page, "c-major-scale");
  const keyText = await page.textContent('[data-testid="meta-key"]');
  expect(keyText).toMatch(/major|minor/);
});

test("score screenshot", async ({ page }) => {
  await uploadFixture(page, "happy-birthday");
  await page.screenshot({ path: "test-results/earworm-ui.png", fullPage: true });
});
