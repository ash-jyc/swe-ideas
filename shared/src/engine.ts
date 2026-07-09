import { RETIREMENT_ID, START_ID, isStopSpace, spaceById } from './board'
import { CAREERS, HOUSES, careerById, houseById } from './careers'
import { CARDS, cardById } from './cards'
import type {
  CarColor,
  CardEffect,
  EventCard,
  GameAction,
  GameEvent,
  GameState,
  PendingChoice,
  PlayerState,
} from './types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const START_CASH = 10_000
export const LOAN_CASH = 20_000
export const LOAN_DEBT = 25_000 // 20k principal + baked-in interest, due at retirement
export const WEDDING_COST = 5_000
export const WEDDING_GIFT = 1_000
export const TAX_AMOUNT = 10_000
export const CRASH_COST = 15_000
export const INSURANCE_COST = 5_000
export const KID_BONUS = 10_000
export const PAYDAY_LANDING_MULT = 1.5
export const GAMBLE_BETS = [5_000, 20_000]
export const GAMBLE_WIN_THRESHOLD = 7 // spin 7-10 wins (40%)
export const GAMBLE_PROFIT_MULT = 1.5 // 2.5x total return
export const MAX_KIDS = 4

export type Rng = () => number

export class EngineError extends Error {}

export interface EngineResult {
  state: GameState
  events: GameEvent[]
}

/** Deterministic RNG for seeded games and tests. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffleInPlace<T>(arr: T[], rng: Rng): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

const fmtK = (n: number) => `$${Math.round(n / 1000)}k`

// ---------------------------------------------------------------------------
// Game setup
// ---------------------------------------------------------------------------

export interface NewPlayer {
  id: string
  name: string
  color: CarColor
}

export function initGame(playersIn: NewPlayer[], rng: Rng): GameState {
  if (playersIn.length < 2 || playersIn.length > 6) {
    throw new EngineError('Game needs 2-6 players')
  }
  const players: PlayerState[] = playersIn.map((p, seat) => ({
    id: p.id,
    name: p.name,
    color: p.color,
    seat,
    position: START_ID,
    history: [START_ID],
    cash: START_CASH,
    debt: 0,
    salary: 0,
    careerId: null,
    houseId: null,
    married: false,
    kids: 0,
    insured: false,
    retired: false,
    skipTurns: 0,
    connected: true,
  }))
  return {
    phase: 'awaitSpin',
    players,
    turnSeat: 0,
    round: 1,
    pending: null,
    deck: shuffleInPlace(CARDS.map((c) => c.id), rng),
    deckPos: 0,
  }
}

// ---------------------------------------------------------------------------
// Internal helpers (mutate the cloned state inside applyAction)
// ---------------------------------------------------------------------------

function currentPlayer(s: GameState): PlayerState {
  return s.players[s.turnSeat]
}

function playerById(s: GameState, id: string): PlayerState {
  const p = s.players.find((p) => p.id === id)
  if (!p) throw new EngineError(`No such player: ${id}`)
  return p
}

/** Adjust cash; auto-borrow in loan increments so cash never goes negative. */
function addCash(s: GameState, ev: GameEvent[], p: PlayerState, delta: number, reason: string) {
  if (delta === 0) return
  p.cash += delta
  ev.push({ type: 'cash', playerId: p.id, delta, reason })
  while (p.cash < 0) {
    p.cash += LOAN_CASH
    p.debt += LOAN_DEBT
    ev.push({ type: 'loan', playerId: p.id, cash: LOAN_CASH, debt: LOAN_DEBT, auto: true })
  }
}

function setPending(s: GameState, ev: GameEvent[], pending: PendingChoice) {
  s.pending = pending
  s.phase = 'awaitChoice'
  ev.push({ type: 'choice', playerId: pending.playerId, prompt: pending.prompt })
}

function roundSalary(n: number): number {
  return Math.max(10_000, Math.round(n / 1000) * 1000)
}

// ---------------------------------------------------------------------------
// Deck
// ---------------------------------------------------------------------------

function matchesRequires(card: EventCard, p: PlayerState): boolean {
  switch (card.requires) {
    case undefined:
      return true
    case 'married':
      return p.married
    case 'single':
      return !p.married
    case 'kids':
      return p.kids > 0
    case 'career':
      return p.careerId !== null
    case 'house':
      return p.houseId !== null
    case 'insured':
      return p.insured
  }
}

function drawCard(s: GameState, p: PlayerState, rng: Rng): EventCard {
  const scan = (): EventCard | null => {
    for (let i = s.deckPos; i < s.deck.length; i++) {
      const card = cardById(s.deck[i])
      if (matchesRequires(card, p)) {
        ;[s.deck[i], s.deck[s.deckPos]] = [s.deck[s.deckPos], s.deck[i]]
        const drawn = cardById(s.deck[s.deckPos])
        s.deckPos++
        return drawn
      }
    }
    return null
  }
  if (s.deckPos >= s.deck.length) {
    shuffleInPlace(s.deck, rng)
    s.deckPos = 0
  }
  let card = scan()
  if (!card) {
    shuffleInPlace(s.deck, rng)
    s.deckPos = 0
    card = scan()
  }
  if (!card) throw new EngineError('Event deck deadlock')
  return card
}

// ---------------------------------------------------------------------------
// Careers & houses
// ---------------------------------------------------------------------------

function sampleCareers(s: GameState, college: boolean, count: number, rng: Rng): string[] {
  const held = new Set(s.players.map((p) => p.careerId).filter(Boolean) as string[])
  const fresh = CAREERS.filter((c) => c.college === college && !held.has(c.id)).map((c) => c.id)
  shuffleInPlace(fresh, rng)
  if (fresh.length < count) {
    const taken = CAREERS.filter((c) => c.college === college && held.has(c.id)).map((c) => c.id)
    shuffleInPlace(taken, rng)
    fresh.push(...taken)
  }
  return fresh.slice(0, count)
}

function sampleHouses(s: GameState, count: number, rng: Rng): string[] {
  const held = new Set(s.players.map((p) => p.houseId).filter(Boolean) as string[])
  const fresh = HOUSES.filter((h) => !held.has(h.id)).map((h) => h.id)
  shuffleInPlace(fresh, rng)
  if (fresh.length < count) {
    const taken = HOUSES.filter((h) => held.has(h.id)).map((h) => h.id)
    shuffleInPlace(taken, rng)
    fresh.push(...taken)
  }
  return fresh.slice(0, count)
}

function assignNewCareer(s: GameState, ev: GameEvent[], p: PlayerState, rng: Rng) {
  const college = p.careerId ? careerById(p.careerId).college : rng() < 0.5
  const [id] = sampleCareers(
    { ...s, players: s.players.map((pl) => (pl.id === p.id ? { ...pl, careerId: null } : pl)) } as GameState,
    college,
    1,
    rng,
  )
  const career = careerById(id)
  p.careerId = career.id
  p.salary = career.salary
  ev.push({ type: 'career', playerId: p.id, careerId: career.id })
}

// ---------------------------------------------------------------------------
// Movement
// ---------------------------------------------------------------------------

/**
 * Walk `steps` spaces forward. Collects paydays passed, halts at stop spaces,
 * pauses (returns false) at forks with a pending choice. Resolves the landing
 * space when movement finishes.
 */
function walk(s: GameState, ev: GameEvent[], p: PlayerState, steps: number, rng: Rng) {
  const path: number[] = []
  const paydays: GameEvent[] = []
  const flush = () => {
    if (path.length) ev.push({ type: 'move', playerId: p.id, path: [...path] })
    ev.push(...paydays)
  }
  while (steps > 0) {
    const sp = spaceById(p.position)
    if (sp.next.length === 0) break // terminal (retirement)
    if (sp.next.length > 1) {
      flush()
      setPending(s, ev, {
        kind: 'fork',
        playerId: p.id,
        prompt: sp.label ? `${sp.label}: choose your path` : 'Choose your path',
        remaining: steps,
        options: sp.forkOptions!.map((o) => ({
          id: String(o.next),
          label: o.label,
          detail: o.detail,
        })),
      })
      return
    }
    const nxt = sp.next[0]
    p.position = nxt
    p.history.push(nxt)
    path.push(nxt)
    steps--
    const nsp = spaceById(nxt)
    if (isStopSpace(nsp)) break
    if (nsp.type === 'PAYDAY' && steps > 0 && p.salary > 0) {
      p.cash += p.salary
      paydays.push({ type: 'payday', playerId: p.id, amount: p.salary })
    }
  }
  flush()
  resolveLanding(s, ev, p, rng)
}

function moveBackward(s: GameState, ev: GameEvent[], p: PlayerState, steps: number) {
  const path: number[] = []
  for (let i = 0; i < steps && p.history.length > 1; i++) {
    p.history.pop()
    const back = p.history[p.history.length - 1]
    p.position = back
    path.push(back)
  }
  if (path.length) ev.push({ type: 'move', playerId: p.id, path, backward: true })
  // Backward landings are inert: no resolution, no paydays.
}

// ---------------------------------------------------------------------------
// Landing resolution
// ---------------------------------------------------------------------------

function resolveLanding(s: GameState, ev: GameEvent[], p: PlayerState, rng: Rng) {
  const sp = spaceById(p.position)
  switch (sp.type) {
    case 'START':
      return
    case 'EVENT': {
      const card = drawCard(s, p, rng)
      ev.push({ type: 'card', playerId: p.id, cardId: card.id })
      if (card.choice) {
        setPending(s, ev, {
          kind: 'card',
          playerId: p.id,
          prompt: card.choice.prompt,
          cardId: card.id,
          options: card.choice.options.map((o) => ({ id: o.id, label: o.label })),
        })
      } else if (card.effect) {
        applyEffect(s, ev, p, card.effect, card.title, rng)
      }
      return
    }
    case 'PAYDAY': {
      if (p.salary > 0) {
        const amount = Math.round((p.salary * PAYDAY_LANDING_MULT) / 1000) * 1000
        p.cash += amount
        ev.push({ type: 'payday', playerId: p.id, amount, landed: true })
      }
      return
    }
    case 'TAX':
      addCash(s, ev, p, -TAX_AMOUNT, 'The IRS always finds you')
      return
    case 'GAMBLE':
      setPending(s, ev, {
        kind: 'gamble',
        playerId: p.id,
        prompt: 'The casino floor calls. Spin 7 or higher to win 2.5x your bet.',
        options: [
          { id: 'skip', label: 'Keep walking', detail: 'Your money stays your money. Boring, effective.' },
          { id: 'bet5', label: `Bet ${fmtK(GAMBLE_BETS[0])}`, detail: `Win ${fmtK(GAMBLE_BETS[0] * GAMBLE_PROFIT_MULT)} profit on 7+` },
          { id: 'bet20', label: `Bet ${fmtK(GAMBLE_BETS[1])}`, detail: `Win ${fmtK(GAMBLE_BETS[1] * GAMBLE_PROFIT_MULT)} profit on 7+` },
        ],
      })
      return
    case 'CRASH': {
      if (p.insured) {
        ev.push({ type: 'crash', playerId: p.id, covered: true })
      } else {
        ev.push({ type: 'crash', playerId: p.id, covered: false })
        addCash(s, ev, p, -CRASH_COST, 'Car crash — no insurance, of course')
      }
      return
    }
    case 'STOP_CAREER': {
      if (p.careerId) return // already employed; nothing to do here
      const ids = sampleCareers(s, sp.collegePool ?? false, 3, rng)
      setPending(s, ev, {
        kind: 'career',
        playerId: p.id,
        prompt: sp.collegePool ? 'You graduated (somehow). Pick a career.' : 'Time to get a job. Pick a career.',
        options: ids.map((id) => {
          const c = careerById(id)
          return { id, label: `${c.title} — ${fmtK(c.salary)}/payday`, detail: c.flavor }
        }),
      })
      return
    }
    case 'STOP_MARRIAGE': {
      if (p.married) return
      setPending(s, ev, {
        kind: 'marriage',
        playerId: p.id,
        prompt: 'The Chapel. Organ music plays. Everyone is looking at you.',
        options: [
          {
            id: 'marry',
            label: `Get married — ${fmtK(WEDDING_COST)}`,
            detail: `Spouse joins your car. Every player owes you a ${fmtK(WEDDING_GIFT)} wedding gift.`,
          },
          { id: 'skip', label: 'Leave them at the altar', detail: 'Cold. Free, but cold.' },
        ],
      })
      return
    }
    case 'STOP_HOUSE': {
      if (p.houseId) return
      const ids = sampleHouses(s, 3, rng)
      setPending(s, ev, {
        kind: 'house',
        playerId: p.id,
        prompt: 'Open house day. The realtor has been drinking.',
        options: [
          ...ids.map((id) => {
            const h = houseById(id)
            return { id, label: `${h.title} — ${fmtK(h.price)} (resale ${fmtK(h.resale)})`, detail: h.flavor }
          }),
          { id: 'skip', label: 'Keep renting', detail: 'The landlord thanks you for building his equity.' },
        ],
      })
      return
    }
    case 'RETIREMENT':
      retirePlayer(s, ev, p)
      return
  }
}

function retirePlayer(s: GameState, ev: GameEvent[], p: PlayerState) {
  if (p.houseId) {
    const h = houseById(p.houseId)
    p.cash += h.resale
    ev.push({ type: 'cash', playerId: p.id, delta: h.resale, reason: `Sold ${h.title}` })
  }
  if (p.kids > 0) {
    const bonus = p.kids * KID_BONUS
    p.cash += bonus
    ev.push({ type: 'cash', playerId: p.id, delta: bonus, reason: 'The kids chip in for the nursing home' })
  }
  if (p.debt > 0) {
    p.cash -= p.debt // settlement may go negative: welcome to retirement
    ev.push({ type: 'cash', playerId: p.id, delta: -p.debt, reason: 'Loans come due, with interest' })
    p.debt = 0
  }
  p.retired = true
  ev.push({ type: 'retire', playerId: p.id, netWorth: p.cash })
  if (s.players.every((pl) => pl.retired)) finishGame(s, ev)
}

function finishGame(s: GameState, ev: GameEvent[]) {
  const ranking = [...s.players]
    .sort((a, b) => b.cash - a.cash)
    .map((p) => ({ playerId: p.id, name: p.name, netWorth: p.cash }))
  s.ranking = ranking
  s.phase = 'gameOver'
  s.pending = null
  ev.push({ type: 'gameOver', ranking })
}

// ---------------------------------------------------------------------------
// Card effects
// ---------------------------------------------------------------------------

function applyEffect(
  s: GameState,
  ev: GameEvent[],
  p: PlayerState,
  eff: CardEffect,
  reason: string,
  rng: Rng,
) {
  if (eff.insurance && !p.insured) {
    p.insured = true
    ev.push({ type: 'insurance', playerId: p.id })
  }
  if (eff.loseInsurance) p.insured = false
  if (eff.salaryPct && p.salary > 0) {
    p.salary = roundSalary(p.salary * (1 + eff.salaryPct / 100))
  }
  if (eff.debt) {
    p.debt = Math.max(0, p.debt + eff.debt)
    ev.push({ type: 'loan', playerId: p.id, cash: 0, debt: eff.debt, auto: false })
  }
  if (eff.cash) addCash(s, ev, p, eff.cash, reason)
  if (eff.cashPerKid && p.kids > 0) addCash(s, ev, p, eff.cashPerKid * p.kids, reason)
  if (eff.collectFromEach) {
    let total = 0
    for (const other of s.players) {
      if (other.id === p.id) continue
      addCash(s, ev, other, -eff.collectFromEach, reason)
      total += eff.collectFromEach
    }
    addCash(s, ev, p, total, reason)
  }
  if (eff.payToEach) {
    for (const other of s.players) {
      if (other.id === p.id) continue
      addCash(s, ev, other, eff.payToEach, reason)
    }
    addCash(s, ev, p, -eff.payToEach * (s.players.length - 1), reason)
  }
  if (eff.marry && !p.married) {
    p.married = true
    ev.push({ type: 'marry', playerId: p.id })
  }
  if (eff.divorce && p.married) {
    p.married = false
    ev.push({ type: 'divorce', playerId: p.id })
    if (p.cash > 0) {
      addCash(s, ev, p, -Math.floor(p.cash / 2), 'Divorce settlement: half of everything')
    }
  }
  if (eff.kids) {
    const added = Math.min(MAX_KIDS - p.kids, eff.kids)
    if (added > 0) {
      p.kids += added
      ev.push({ type: 'kid', playerId: p.id, count: p.kids })
    }
  }
  if (eff.newCareer) assignNewCareer(s, ev, p, rng)
  if (eff.skipTurn) p.skipTurns++
  if (eff.gamble) {
    const won = rng() < 0.5
    const delta = won ? eff.gamble.win : -eff.gamble.lose
    addCash(s, ev, p, delta, won ? `${reason} — it paid off!` : `${reason} — it did not pay off`)
  }
  if (eff.move) {
    if (eff.move > 0) walk(s, ev, p, eff.move, rng)
    else moveBackward(s, ev, p, -eff.move)
  }
}

// ---------------------------------------------------------------------------
// Choice resolution
// ---------------------------------------------------------------------------

function resolveChoice(s: GameState, ev: GameEvent[], p: PlayerState, optionId: string, rng: Rng) {
  const pending = s.pending!
  const valid = pending.options.some((o) => o.id === optionId)
  if (!valid) throw new EngineError(`Invalid option: ${optionId}`)
  s.pending = null
  s.phase = 'awaitSpin' // provisional; setPending/gameOver may override below

  switch (pending.kind) {
    case 'fork': {
      const sp = spaceById(p.position)
      const opt = sp.forkOptions!.find((o) => String(o.next) === optionId)!
      if (opt.debt) {
        p.debt += opt.debt
        ev.push({ type: 'loan', playerId: p.id, cash: 0, debt: opt.debt, auto: false })
      }
      p.position = opt.next
      p.history.push(opt.next)
      ev.push({ type: 'move', playerId: p.id, path: [opt.next] })
      const nsp = spaceById(opt.next)
      const remaining = (pending.remaining ?? 1) - 1
      if (isStopSpace(nsp) || remaining === 0) {
        resolveLanding(s, ev, p, rng)
      } else {
        if (nsp.type === 'PAYDAY' && p.salary > 0) {
          p.cash += p.salary
          ev.push({ type: 'payday', playerId: p.id, amount: p.salary })
        }
        walk(s, ev, p, remaining, rng)
      }
      return
    }
    case 'career': {
      const career = careerById(optionId)
      p.careerId = career.id
      p.salary = career.salary
      ev.push({ type: 'career', playerId: p.id, careerId: career.id })
      if (!p.insured) {
        setPending(s, ev, {
          kind: 'insurance',
          playerId: p.id,
          prompt: 'Adulting starter pack: car insurance?',
          options: [
            {
              id: 'buy',
              label: `Buy insurance — ${fmtK(INSURANCE_COST)}`,
              detail: 'Covers every crash on this board, forever. Suspiciously good deal.',
            },
            { id: 'skip', label: 'Skip it', detail: 'What could possibly happen? (A lot. A lot could happen.)' },
          ],
        })
      }
      return
    }
    case 'insurance': {
      if (optionId === 'buy') {
        addCash(s, ev, p, -INSURANCE_COST, 'Car insurance')
        p.insured = true
        ev.push({ type: 'insurance', playerId: p.id })
      }
      return
    }
    case 'marriage': {
      if (optionId === 'marry') {
        addCash(s, ev, p, -WEDDING_COST, 'The wedding (open bar, obviously)')
        p.married = true
        ev.push({ type: 'marry', playerId: p.id })
        let gifts = 0
        for (const other of s.players) {
          if (other.id === p.id) continue
          addCash(s, ev, other, -WEDDING_GIFT, `Wedding gift for ${p.name}`)
          gifts += WEDDING_GIFT
        }
        if (gifts > 0) addCash(s, ev, p, gifts, 'Wedding gifts')
      }
      return
    }
    case 'house': {
      if (optionId !== 'skip') {
        const h = houseById(optionId)
        addCash(s, ev, p, -h.price, `Bought ${h.title}`)
        p.houseId = h.id
        ev.push({ type: 'house', playerId: p.id, houseId: h.id })
      }
      return
    }
    case 'gamble': {
      if (optionId !== 'skip') {
        const bet = optionId === 'bet5' ? GAMBLE_BETS[0] : GAMBLE_BETS[1]
        const roll = 1 + Math.floor(rng() * 10)
        const won = roll >= GAMBLE_WIN_THRESHOLD
        ev.push({ type: 'gamble', playerId: p.id, bet, roll, won })
        addCash(
          s,
          ev,
          p,
          won ? bet * GAMBLE_PROFIT_MULT : -bet,
          won ? 'The house lost, somehow' : 'The house always wins',
        )
      }
      return
    }
    case 'card': {
      const card = cardById(pending.cardId!)
      const opt = card.choice!.options.find((o) => o.id === optionId)!
      applyEffect(s, ev, p, opt.effect, card.title, rng)
      return
    }
  }
}

// ---------------------------------------------------------------------------
// Turn management
// ---------------------------------------------------------------------------

function advanceTurn(s: GameState, ev: GameEvent[]) {
  if (s.players.every((p) => p.retired)) {
    if (s.phase !== 'gameOver') finishGame(s, ev)
    return
  }
  let seat = s.turnSeat
  for (let guard = 0; guard < 10_000; guard++) {
    seat = (seat + 1) % s.players.length
    if (seat === 0) s.round++
    const p = s.players[seat]
    if (p.retired) continue
    if (p.skipTurns > 0) {
      p.skipTurns--
      ev.push({ type: 'skip', playerId: p.id })
      continue
    }
    s.turnSeat = seat
    s.phase = 'awaitSpin'
    ev.push({ type: 'turn', playerId: p.id })
    return
  }
  throw new EngineError('Turn advance deadlock')
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function applyAction(
  state: GameState,
  playerId: string,
  action: GameAction,
  rng: Rng,
): EngineResult {
  if (state.phase === 'gameOver') throw new EngineError('The game is over')
  const s = structuredClone(state)
  const ev: GameEvent[] = []
  const p = playerById(s, playerId)

  switch (action.type) {
    case 'spin': {
      if (s.phase !== 'awaitSpin') throw new EngineError('Not time to spin')
      if (currentPlayer(s).id !== playerId) throw new EngineError('Not your turn')
      if (p.retired) throw new EngineError('You are retired')
      const value = 1 + Math.floor(rng() * 10)
      ev.push({ type: 'spin', playerId, value })
      walk(s, ev, p, value, rng)
      break
    }
    case 'choose': {
      if (s.phase !== 'awaitChoice' || !s.pending) throw new EngineError('Nothing to choose')
      if (s.pending.playerId !== playerId) throw new EngineError('Not your choice')
      resolveChoice(s, ev, p, action.optionId, rng)
      break
    }
    case 'loan': {
      if (currentPlayer(s).id !== playerId) throw new EngineError('Not your turn')
      if (p.retired) throw new EngineError('You are retired')
      p.cash += LOAN_CASH
      p.debt += LOAN_DEBT
      ev.push({ type: 'loan', playerId, cash: LOAN_CASH, debt: LOAN_DEBT, auto: false })
      // Loans don't end the turn.
      return { state: s, events: ev }
    }
  }

  // walk/resolveChoice may have mutated phase; widen past TS's stale narrowing
  if (!s.pending && (s.phase as GameState['phase']) !== 'gameOver') {
    advanceTurn(s, ev)
  }
  return { state: s, events: ev }
}

/** Sensible default for auto-resolving a disconnected player's choice. */
export function defaultOptionId(pending: PendingChoice, rng: Rng = Math.random): string {
  switch (pending.kind) {
    case 'fork':
      return pending.options[Math.floor(rng() * pending.options.length)].id
    case 'career':
    case 'card':
      return pending.options[0].id
    case 'marriage':
    case 'house':
    case 'gamble':
    case 'insurance':
      return 'skip'
  }
}
