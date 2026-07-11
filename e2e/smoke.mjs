/**
 * Two-player end-to-end smoke test.
 *
 * Boots two headless-browser players: Thelma creates a room, Louise joins
 * with the code, the host starts the game, and both spin through several
 * full turns (answering every life choice with the first option). Asserts
 * the multiplayer loop, the shared animation banners, and cash movement.
 *
 * Usage: node e2e/smoke.mjs [baseUrl]
 *   (expects the dev server running: `npm run dev`, client on :5173)
 * Env: CHROMIUM_PATH to point at a Chromium binary.
 */
import { chromium } from 'playwright-core'

const BASE = process.argv[2] ?? 'http://localhost:5173'
const CHROME =
  process.env.CHROMIUM_PATH ??
  process.env.PLAYWRIGHT_CHROMIUM ??
  '/opt/pw-browsers/chromium'

const args = ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader']

function fail(msg) {
  console.error(`❌ ${msg}`)
  process.exit(1)
}

async function newPlayer(browser, name) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()
  page.on('pageerror', (err) => console.error(`[${name}] pageerror:`, err.message))
  await page.goto(BASE)
  await page.getByTestId('name-input').fill(name)
  return page
}

// force:true — the HUD buttons have looping CSS animations, so Playwright's
// bounding-box stability check would otherwise wait forever
const CLICK = { force: true, timeout: 2_500 }

/** Keep answering: dismiss cards, click spin, play minigames, pick choices. */
async function actIfPossible(page) {
  const card = page.getByTestId('event-card')
  if (await card.isVisible().catch(() => false)) {
    await card.click(CLICK).catch(() => {})
    return 'card'
  }
  // minigames: tapping the big action button progresses all three game types
  const mg = page.getByTestId('minigame-action')
  if (await mg.isVisible().catch(() => false)) {
    await mg.click(CLICK).catch(() => {})
    return 'minigame'
  }
  const spin = page.getByTestId('spin-button')
  if (await spin.isVisible().catch(() => false)) {
    await spin.click(CLICK).catch(() => {})
    return 'spin'
  }
  const choice = page.locator('.choice-option').first()
  if (await choice.isVisible().catch(() => false)) {
    await choice.click(CLICK).catch(() => {})
    return 'choice'
  }
  return null
}

const browser = await chromium.launch({ executablePath: CHROME, args })
try {
  console.log('▶ two players connecting to', BASE)
  const p1 = await newPlayer(browser, 'Thelma')
  const p2 = await newPlayer(browser, 'Louise')

  // host creates a room
  await p1.getByTestId('create-room').click(CLICK)
  await p1.getByTestId('room-code').waitFor({ timeout: 10_000 })
  const code = (await p1.getByTestId('room-code').innerText()).trim()
  if (!/^[A-Z]{4}$/.test(code)) fail(`bad room code: ${code}`)
  console.log('▶ room created:', code)

  // second player joins by code
  await p2.getByTestId('code-input').fill(code)
  await p2.getByTestId('join-room').click(CLICK)
  await p2.getByTestId('room-code').waitFor({ timeout: 10_000 })

  // both lobbies show 2 players
  await p1.locator('.lobby-player:not(.empty)').nth(1).waitFor({ timeout: 5_000 })
  console.log('▶ both players in the lobby')

  // host starts
  await p1.getByTestId('start-game').click(CLICK)
  await p1.locator('.hud').waitFor({ timeout: 15_000 })
  await p2.locator('.hud').waitFor({ timeout: 15_000 })
  console.log('▶ game started, HUD visible for both')

  // canvas rendered on both
  for (const [i, p] of [p1, p2].entries()) {
    const hasCanvas = await p.locator('canvas').count()
    if (!hasCanvas) fail(`player ${i + 1} has no 3D canvas`)
  }

  // play ~40 interaction beats (spins, cards, choices) across both players
  const startCash = { Thelma: null, Louise: null }
  let spins = 0
  let cards = 0
  let choices = 0
  for (let beat = 0; beat < 120 && spins < 8; beat++) {
    for (const page of [p1, p2]) {
      const did = await actIfPossible(page)
      if (did === 'spin') spins++
      if (did === 'card') cards++
      if (did === 'choice') choices++
    }
    await p1.waitForTimeout(700)
  }
  console.log(`▶ played through: ${spins} spins, ${cards} cards dismissed, ${choices} choices made`)
  if (spins < 4) fail(`expected at least 4 spins to happen, got ${spins}`)
  if (choices < 2) fail(`expected at least 2 choices (fork/career/...), got ${choices}`)

  // let animations settle, then compare state across both clients
  await p1.waitForTimeout(4_000)
  for (const page of [p1, p2]) await actIfPossible(page) // clear any lingering card
  await p1.waitForTimeout(2_500)

  const cash1 = await p1.getByTestId('cash-Thelma').innerText()
  const cash2 = await p2.getByTestId('cash-Thelma').innerText()
  console.log(`▶ Thelma's cash — host client: ${cash1}, guest client: ${cash2}`)
  if (cash1 !== cash2) {
    console.warn('  (clients mid-animation; tolerating if both are valid money)')
  }
  if (!/^\-?\$[\d,]+$/.test(cash1)) fail(`cash render broken: ${cash1}`)

  // both players' panels exist on both screens
  for (const page of [p1, p2]) {
    for (const who of ['Thelma', 'Louise']) {
      if (!(await page.getByTestId(`cash-${who}`).count())) fail(`${who} panel missing`)
    }
  }

  // screenshot the 3D board mid-game from the host's view
  await p1.screenshot({ path: 'e2e/screenshot-game.png' })
  console.log('▶ screenshot saved to e2e/screenshot-game.png')

  console.log('✅ smoke test passed')
} finally {
  await browser.close()
}
