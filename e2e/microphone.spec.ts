import { expect, test } from "@playwright/test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

// Chromium's fake media stack feeds a WAV file to getUserMedia, exercising
// the real record → live-feedback → stop → transcribe path.
test.use({
  launchOptions: {
    ...(process.env.EARWORM_CHROMIUM ? { executablePath: process.env.EARWORM_CHROMIUM } : {}),
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
      `--use-file-for-fake-audio-capture=${join(fixturesDir, "c-major-scale.wav")}`,
      "--autoplay-policy=no-user-gesture-required",
    ],
  },
});

test("records from the microphone and transcribes the hum", async ({ page }) => {
  await page.goto("/");
  await page.click("#record-btn");
  await expect(page.locator("#record-btn")).toHaveText(/Stop/);
  // Live pitch feedback should appear while the fake mic plays the hum.
  await expect(page.locator("#live-pitch")).toBeVisible();
  await expect(page.locator("#live-note")).not.toHaveText("—", { timeout: 10_000 });

  // The fixture is ~5.5s long; record most of it, then stop.
  await page.waitForTimeout(5_200);
  await page.click("#record-btn");

  await expect(page.locator("#result")).toBeVisible({ timeout: 15_000 });
  const state = await page.evaluate(
    () => (window as never as { __earworm: { notes: Array<{ midi: number }> } }).__earworm,
  );
  const midis = state.notes.map((n) => n.midi);
  // The capture window may clip the last note or catch the loop restarting,
  // so require the ascending scale as a prefix rather than an exact match.
  const scale = [60, 62, 64, 65, 67, 69, 71, 72];
  expect(midis.length).toBeGreaterThanOrEqual(6);
  expect(midis.slice(0, 6)).toEqual(scale.slice(0, 6));
});
