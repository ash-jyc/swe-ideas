// End-to-end smoke test driven through the real UI with a headless browser.
// Uses the `mock` provider so no API keys are needed.
//
//   node e2e/smoke.mjs            # against http://localhost:3009
//   BASE=http://localhost:3001 node e2e/smoke.mjs
//
// Exercises: create project → prompt (mock, vulnerable) → streamed files →
// live preview → security findings → deploy.

import { chromium } from 'playwright-core';

const BASE = process.env.BASE || 'http://localhost:3009';
const HEADLESS = process.env.HEADFUL !== '1';
// Use the pre-installed Chromium (its version may differ from what
// playwright-core would download). The symlink is stable across builds.
const EXECUTABLE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';

function log(step) {
  console.log(`✓ ${step}`);
}

async function main() {
  const browser = await chromium.launch({
    headless: HEADLESS,
    executablePath: EXECUTABLE,
  });
  const page = await browser.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') console.log('  [browser error]', m.text());
  });

  try {
    // 1. Load dashboard and inject mock BYOK credentials.
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      localStorage.setItem(
        'vibe.byok.v1',
        JSON.stringify({ provider: 'mock', model: 'mock-vulnerable' }),
      );
    });
    await page.reload({ waitUntil: 'networkidle' });
    log('dashboard loaded');

    // 2. Create a project.
    await page.getByRole('button', { name: '+ New project' }).first().click();
    await page.getByPlaceholder('My awesome app').fill('Smoke Notes');
    await page.getByRole('button', { name: 'Create' }).click();
    await page.waitForURL(/\/p\/.+/, { timeout: 15000 });
    log('project created, workspace open');

    // 3. Send a prompt and wait for generation to finish.
    await page.getByPlaceholder(/build a URL shortener/).fill('a notes app with search');
    await page.getByRole('button', { name: 'Send' }).click();
    // File chips (e.g. "✎ server.js") appear as file-op events stream in.
    await page.waitForSelector('text=server.js', { timeout: 30000 });
    log('generation complete, files present');

    // 4. Preview tab: expect a running app in the iframe.
    await page.getByRole('button', { name: 'Preview' }).click();
    await page.waitForSelector('iframe[title="preview"]', { timeout: 30000 });
    const frame = page.frameLocator('iframe[title="preview"]');
    await frame.getByText('Notes').first().waitFor({ timeout: 30000 });
    log('live preview renders the generated app');

    // 5. Security tab: run analysis and expect findings.
    await page.getByRole('button', { name: /Security/ }).click();
    await page.getByRole('button', { name: 'Analyze latest turn' }).click();
    await page.waitForSelector('text=/CWE-\\d+/', { timeout: 30000 });
    log('security analysis produced findings');

    // 6. Deploy.
    await page.getByRole('button', { name: /Deploy/ }).first().click();
    await page.getByRole('button', { name: 'Deploy', exact: true }).click();
    await page.waitForSelector('text=Live at', { timeout: 30000 });
    log('deployed to a shareable URL');

    console.log('\nAll smoke checks passed.');
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error('\nSMOKE TEST FAILED:', e.message);
  process.exit(1);
});
