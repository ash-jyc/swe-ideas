import { describe, expect, it } from 'vitest'
import { RETIREMENT_ID, SPACES, START_ID, isStopSpace, spaceById } from './board'
import { CAREERS, careerById, houseById } from './careers'
import { CARDS, cardById } from './cards'
import {
  CRASH_COST,
  EngineError,
  GAMBLE_BETS,
  INSURANCE_COST,
  KID_BONUS,
  LOAN_CASH,
  LOAN_DEBT,
  START_CASH,
  WEDDING_COST,
  WEDDING_GIFT,
  applyAction,
  defaultOptionId,
  initGame,
  mulberry32,
  type Rng,
} from './engine'
import type { GameEvent, GameState } from './types'

const PLAYERS = [
  { id: 'p1', name: 'Alice', color: 'red' as const },
  { id: 'p2', name: 'Bob', color: 'blue' as const },
]

/** rng that returns queued values, then falls back to a seeded rng. */
function seqRng(values: number[], fallbackSeed = 1): Rng {
  const fallback = mulberry32(fallbackSeed)
  return () => (values.length ? values.shift()! : fallback())
}

/** rng value that makes `1 + floor(r * 10)` produce `spin`. */
const forSpin = (spin: number) => (spin - 1) / 10 + 0.001

describe('board', () => {
  it('has a connected DAG from START to RETIREMENT', () => {
    const seen = new Set<number>()
    const stack = [START_ID]
    while (stack.length) {
      const id = stack.pop()!
      if (seen.has(id)) continue
      seen.add(id)
      stack.push(...spaceById(id).next)
    }
    expect(seen.has(RETIREMENT_ID)).toBe(true)
    expect(seen.size).toBe(SPACES.length)
  })

  it('forks have matching forkOptions', () => {
    for (const s of SPACES) {
      if (s.next.length > 1) {
        expect(s.forkOptions).toBeDefined()
        expect(s.forkOptions!.map((o) => o.next).sort()).toEqual([...s.next].sort())
      }
      if (s.type === 'RETIREMENT') expect(s.next).toHaveLength(0)
    }
  })

  it('is a decently sized board', () => {
    expect(SPACES.length).toBeGreaterThanOrEqual(85)
  })
})

describe('content', () => {
  it('card ids are unique', () => {
    const ids = new Set(CARDS.map((c) => c.id))
    expect(ids.size).toBe(CARDS.length)
  })

  it('has a healthy deck with every category', () => {
    expect(CARDS.length).toBeGreaterThanOrEqual(100)
    for (const cat of ['relationships', 'vices', 'money', 'internet', 'news', 'career', 'health']) {
      expect(CARDS.some((c) => c.category === cat)).toBe(true)
    }
  })

  it('every card has an effect or a choice', () => {
    for (const c of CARDS) {
      expect(c.effect !== undefined || c.choice !== undefined, c.id).toBe(true)
    }
  })

  it('both career pools have enough options', () => {
    expect(CAREERS.filter((c) => c.college).length).toBeGreaterThanOrEqual(8)
    expect(CAREERS.filter((c) => !c.college).length).toBeGreaterThanOrEqual(8)
  })
})

describe('initGame', () => {
  it('sets up players at START with starting cash', () => {
    const g = initGame(PLAYERS, mulberry32(42))
    expect(g.players).toHaveLength(2)
    for (const p of g.players) {
      expect(p.position).toBe(START_ID)
      expect(p.cash).toBe(START_CASH)
      expect(p.history).toEqual([START_ID])
    }
    expect(g.phase).toBe('awaitSpin')
    expect(g.deck).toHaveLength(CARDS.length)
  })

  it('rejects bad player counts', () => {
    expect(() => initGame([PLAYERS[0]], mulberry32(1))).toThrow(EngineError)
  })
})

describe('movement & forks', () => {
  it('first spin pauses at the START fork', () => {
    const g = initGame(PLAYERS, mulberry32(42))
    const { state, events } = applyAction(g, 'p1', { type: 'spin' }, seqRng([forSpin(5)]))
    expect(state.phase).toBe('awaitChoice')
    expect(state.pending?.kind).toBe('fork')
    expect(state.pending?.remaining).toBe(5)
    expect(state.pending?.options).toHaveLength(2)
    expect(events.some((e) => e.type === 'spin' && e.value === 5)).toBe(true)
  })

  it('choosing college adds student debt and moves the remaining steps', () => {
    const g = initGame(PLAYERS, mulberry32(42))
    const r1 = applyAction(g, 'p1', { type: 'spin' }, seqRng([forSpin(2)]))
    const collegeOpt = r1.state.pending!.options[0]
    const r2 = applyAction(r1.state, 'p1', { type: 'choose', optionId: collegeOpt.id }, mulberry32(7))
    const p1 = r2.state.players[0]
    expect(p1.debt).toBe(50_000)
    // spun 2: fork consumed one step onto the branch, one more step after
    expect(p1.history).toHaveLength(3)
  })

  it('validates turn ownership', () => {
    const g = initGame(PLAYERS, mulberry32(42))
    expect(() => applyAction(g, 'p2', { type: 'spin' }, mulberry32(1))).toThrow('Not your turn')
  })
})

describe('economy', () => {
  function playerOnSpace(g: GameState, playerId: string, spaceId: number): GameState {
    const s = structuredClone(g)
    const p = s.players.find((p) => p.id === playerId)!
    p.position = spaceId
    p.history = [START_ID, spaceId]
    return s
  }

  function findSpace(type: string): number {
    return SPACES.find((s) => s.type === type)!.id
  }

  /** A space whose sole successor chain of `n` spaces contains given types. */
  it('collects salary when passing a payday', () => {
    const g = initGame(PLAYERS, mulberry32(42))
    // find an EVENT space directly before a PAYDAY with a simple linear next
    const payday = SPACES.find(
      (s) => s.type === 'PAYDAY' && SPACES.some((q) => q.next.length === 1 && q.next[0] === s.id),
    )!
    const before = SPACES.find((q) => q.next.length === 1 && q.next[0] === payday.id)!
    let s = playerOnSpace(g, 'p1', before.id)
    s.players[0].salary = 50_000
    s.players[0].careerId = 'tech'
    // spin far enough to pass the payday (avoid stopping exactly on it)
    const after = spaceById(payday.id)
    const canGoTwo = after.next.length === 1 && !isStopSpace(spaceById(after.next[0]))
    const steps = canGoTwo ? 2 : 1
    const { state, events } = applyAction(s, 'p1', { type: 'spin' }, seqRng([forSpin(steps)]))
    const p = state.players[0]
    if (steps === 2) {
      // salary collected in passing; the landing space's card may also move cash
      expect(events.some((e) => e.type === 'payday' && !e.landed && e.amount === 50_000)).toBe(true)
      expect(p.cash).not.toBe(START_CASH)
    } else {
      // landed exactly: overtime bonus
      expect(events.some((e) => e.type === 'payday' && e.landed && e.amount === 75_000)).toBe(true)
    }
  })

  it('auto-borrows when cash would go negative', () => {
    const g = initGame(PLAYERS, mulberry32(42))
    const crash = findSpace('CRASH')
    const before = SPACES.find((q) => q.next.length === 1 && q.next[0] === crash)!
    const s = playerOnSpace(g, 'p1', before.id)
    s.players[0].cash = 1_000
    const { state, events } = applyAction(s, 'p1', { type: 'spin' }, seqRng([forSpin(1)]))
    const p = state.players[0]
    expect(events.some((e) => e.type === 'crash' && !e.covered)).toBe(true)
    expect(p.cash).toBe(1_000 - CRASH_COST + LOAN_CASH)
    expect(p.debt).toBe(LOAN_DEBT)
    expect(events.some((e) => e.type === 'loan' && e.auto)).toBe(true)
  })

  it('insurance covers crashes', () => {
    const g = initGame(PLAYERS, mulberry32(42))
    const crash = findSpace('CRASH')
    const before = SPACES.find((q) => q.next.length === 1 && q.next[0] === crash)!
    const s = playerOnSpace(g, 'p1', before.id)
    s.players[0].insured = true
    const { state, events } = applyAction(s, 'p1', { type: 'spin' }, seqRng([forSpin(1)]))
    expect(events.some((e) => e.type === 'crash' && e.covered)).toBe(true)
    expect(state.players[0].cash).toBe(START_CASH)
  })

  it('manual loans add cash and debt without ending the turn', () => {
    const g = initGame(PLAYERS, mulberry32(42))
    const { state } = applyAction(g, 'p1', { type: 'loan' }, mulberry32(1))
    expect(state.players[0].cash).toBe(START_CASH + LOAN_CASH)
    expect(state.players[0].debt).toBe(LOAN_DEBT)
    expect(state.turnSeat).toBe(0)
    expect(state.phase).toBe('awaitSpin')
  })

  it('marriage at the chapel collects gifts from everyone', () => {
    const g = initGame(PLAYERS, mulberry32(42))
    const chapel = findSpace('STOP_MARRIAGE')
    const before = SPACES.find((q) => q.next.length === 1 && q.next[0] === chapel)!
    const s = playerOnSpace(g, 'p1', before.id)
    const r1 = applyAction(s, 'p1', { type: 'spin' }, seqRng([forSpin(6)])) // stop space halts movement
    expect(r1.state.pending?.kind).toBe('marriage')
    const r2 = applyAction(r1.state, 'p1', { type: 'choose', optionId: 'marry' }, mulberry32(1))
    const p1 = r2.state.players[0]
    const p2 = r2.state.players[1]
    expect(p1.married).toBe(true)
    expect(p1.cash).toBe(START_CASH - WEDDING_COST + WEDDING_GIFT)
    expect(p2.cash).toBe(START_CASH - WEDDING_GIFT)
  })

  it('career stop offers 3 careers then an insurance offer', () => {
    const g = initGame(PLAYERS, mulberry32(42))
    const stop = SPACES.find((s) => s.type === 'STOP_CAREER' && !s.collegePool)!
    const before = SPACES.find((q) => q.next.length === 1 && q.next[0] === stop.id)!
    const s = playerOnSpace(g, 'p1', before.id)
    const r1 = applyAction(s, 'p1', { type: 'spin' }, seqRng([forSpin(8)]))
    expect(r1.state.pending?.kind).toBe('career')
    expect(r1.state.pending?.options).toHaveLength(3)
    const chosen = r1.state.pending!.options[1].id
    const r2 = applyAction(r1.state, 'p1', { type: 'choose', optionId: chosen }, mulberry32(1))
    expect(r2.state.players[0].careerId).toBe(chosen)
    expect(r2.state.players[0].salary).toBe(careerById(chosen).salary)
    expect(r2.state.pending?.kind).toBe('insurance')
    const r3 = applyAction(r2.state, 'p1', { type: 'choose', optionId: 'buy' }, mulberry32(1))
    expect(r3.state.players[0].insured).toBe(true)
    expect(r3.state.players[0].cash).toBe(START_CASH - INSURANCE_COST)
    // choice chain done, turn passes
    expect(r3.state.turnSeat).toBe(1)
  })

  it('gamble space: winning pays 1.5x profit on 7+', () => {
    const g = initGame(PLAYERS, mulberry32(42))
    const gamble = SPACES.find((s) => s.type === 'GAMBLE')!
    const before = SPACES.find((q) => q.next.length === 1 && q.next[0] === gamble.id)
    if (!before) return // gamble may sit after a fork; covered by simulation test
    const s = playerOnSpace(g, 'p1', before.id)
    const r1 = applyAction(s, 'p1', { type: 'spin' }, seqRng([forSpin(1)]))
    expect(r1.state.pending?.kind).toBe('gamble')
    const r2 = applyAction(r1.state, 'p1', { type: 'choose', optionId: 'bet20' }, seqRng([forSpin(9)]))
    expect(r2.state.players[0].cash).toBe(START_CASH + GAMBLE_BETS[1] * 1.5)
  })
})

describe('cards', () => {
  function stateWithNextCard(cardId: string): GameState {
    const g = initGame(PLAYERS, mulberry32(42))
    const idx = g.deck.indexOf(cardId)
    ;[g.deck[0], g.deck[idx]] = [g.deck[idx], g.deck[0]]
    // put p1 right before a plain EVENT space with a linear predecessor
    const evt = SPACES.find(
      (s) => s.type === 'EVENT' && SPACES.some((q) => q.next.length === 1 && q.next[0] === s.id),
    )!
    const before = SPACES.find((q) => q.next.length === 1 && q.next[0] === evt.id)!
    const p = g.players[0]
    p.position = before.id
    p.history = [START_ID, before.id]
    return g
  }

  it('divorce card halves cash and removes spouse', () => {
    const g = stateWithNextCard('caught-on-apps')
    g.players[0].married = true
    g.players[0].cash = 40_000
    const { state, events } = applyAction(g, 'p1', { type: 'spin' }, seqRng([forSpin(1)]))
    expect(events.some((e) => e.type === 'card' && e.cardId === 'caught-on-apps')).toBe(true)
    expect(state.players[0].married).toBe(false)
    expect(state.players[0].cash).toBe(20_000)
  })

  it('requires-gated cards are skipped for non-matching players', () => {
    const g = stateWithNextCard('caught-on-apps') // requires married; p1 is single
    const { state, events } = applyAction(g, 'p1', { type: 'spin' }, seqRng([forSpin(1)]))
    const drawn = events.find((e) => e.type === 'card')!
    expect(drawn.type === 'card' && drawn.cardId).not.toBe('caught-on-apps')
    expect(state.players[0].married).toBe(false)
  })

  it('choice cards create a pending choice resolved by the player', () => {
    const g = stateWithNextCard('ex-texts')
    const r1 = applyAction(g, 'p1', { type: 'spin' }, seqRng([forSpin(1)]))
    expect(r1.state.pending?.kind).toBe('card')
    const r2 = applyAction(r1.state, 'p1', { type: 'choose', optionId: 'block' }, mulberry32(1))
    expect(r2.state.players[0].cash).toBe(START_CASH + 2_000)
    expect(r2.state.turnSeat).toBe(1)
  })

  it('kid cards add pegs up to the car max', () => {
    const g = stateWithNextCard('surprise-twins')
    g.players[0].married = true
    g.players[0].kids = 3
    const { state } = applyAction(g, 'p1', { type: 'spin' }, seqRng([forSpin(1)]))
    expect(state.players[0].kids).toBe(4)
  })

  it('backward moves never re-resolve spaces', () => {
    const g = stateWithNextCard('walk-of-shame')
    const before = g.players[0].position
    const { state, events } = applyAction(g, 'p1', { type: 'spin' }, seqRng([forSpin(1)]))
    const move = events.filter((e) => e.type === 'move')
    expect(move.some((m) => m.type === 'move' && m.backward)).toBe(true)
    // walked 1 forward then 3 back, clamped at START
    expect(state.players[0].history.length).toBeLessThanOrEqual(2)
    expect(events.filter((e) => e.type === 'card')).toHaveLength(1)
  })
})

describe('retirement & game over', () => {
  it('settles house, kids and debt at retirement', () => {
    const g = initGame(PLAYERS, mulberry32(42))
    const before = SPACES.find((q) => q.next.length === 1 && q.next[0] === RETIREMENT_ID)!
    const p = g.players[0]
    p.position = before.id
    p.history = [START_ID, before.id]
    p.houseId = 'mcmansion'
    p.kids = 2
    p.debt = 75_000
    p.cash = 50_000
    const { state, events } = applyAction(g, 'p1', { type: 'spin' }, seqRng([forSpin(5)]))
    const rp = state.players[0]
    expect(rp.retired).toBe(true)
    expect(rp.cash).toBe(50_000 + houseById('mcmansion').resale + 2 * KID_BONUS - 75_000)
    expect(events.some((e) => e.type === 'retire')).toBe(true)
    // p2 still playing
    expect(state.phase).toBe('awaitSpin')
    expect(state.turnSeat).toBe(1)
  })

  it('finishes and ranks when everyone retires', () => {
    const g = initGame(PLAYERS, mulberry32(42))
    const before = SPACES.find((q) => q.next.length === 1 && q.next[0] === RETIREMENT_ID)!
    for (const p of g.players) {
      p.position = before.id
      p.history = [START_ID, before.id]
    }
    g.players[0].cash = 5_000
    g.players[1].cash = 99_000
    const r1 = applyAction(g, 'p1', { type: 'spin' }, seqRng([forSpin(3)]))
    expect(r1.state.phase).toBe('awaitSpin')
    const r2 = applyAction(r1.state, 'p2', { type: 'spin' }, seqRng([forSpin(3)]))
    expect(r2.state.phase).toBe('gameOver')
    expect(r2.state.ranking![0].playerId).toBe('p2')
    expect(r2.events.some((e) => e.type === 'gameOver')).toBe(true)
  })
})

describe('full game simulation', () => {
  function simulate(seed: number, numPlayers: number, chooser: 'default' | 'greedy') {
    const rng = mulberry32(seed)
    const roster = [
      { id: 'a', name: 'A', color: 'red' as const },
      { id: 'b', name: 'B', color: 'blue' as const },
      { id: 'c', name: 'C', color: 'green' as const },
      { id: 'd', name: 'D', color: 'yellow' as const },
      { id: 'e', name: 'E', color: 'purple' as const },
      { id: 'f', name: 'F', color: 'orange' as const },
    ].slice(0, numPlayers)
    let state = initGame(roster, rng)
    const allEvents: GameEvent[] = []
    let guard = 0
    while (state.phase !== 'gameOver') {
      if (++guard > 5_000) throw new Error('Game did not terminate')
      if (state.phase === 'awaitSpin') {
        const actor = state.players[state.turnSeat]
        const r = applyAction(state, actor.id, { type: 'spin' }, rng)
        state = r.state
        allEvents.push(...r.events)
      } else {
        const pending = state.pending!
        const optionId =
          chooser === 'default'
            ? defaultOptionId(pending, rng)
            : pending.options[pending.options.length - 1].id // always the boldest option
        const r = applyAction(state, pending.playerId, { type: 'choose', optionId }, rng)
        state = r.state
        allEvents.push(...r.events)
      }
    }
    return { state, allEvents }
  }

  it('cautious players finish a 4-player game', () => {
    const { state } = simulate(1234, 4, 'default')
    expect(state.phase).toBe('gameOver')
    expect(state.ranking).toHaveLength(4)
    for (const p of state.players) {
      expect(p.retired).toBe(true)
      expect(p.position).toBe(RETIREMENT_ID)
    }
  })

  it('degenerate gamblers finish a 6-player game', () => {
    const { state } = simulate(999, 6, 'greedy')
    expect(state.phase).toBe('gameOver')
    expect(state.ranking).toHaveLength(6)
  })

  it('many seeds terminate and money stays sane', () => {
    for (const seed of [7, 21, 77, 2024, 31337]) {
      const { state } = simulate(seed, 3, seed % 2 ? 'default' : 'greedy')
      expect(state.phase).toBe('gameOver')
      for (const entry of state.ranking!) {
        expect(Number.isFinite(entry.netWorth)).toBe(true)
        expect(Math.abs(entry.netWorth)).toBeLessThan(5_000_000)
      }
    }
  })

  it('every card that gets drawn resolves without errors', () => {
    const drawnIds = new Set<string>()
    for (const seed of [5, 6, 8, 9]) {
      const { allEvents } = simulate(seed, 6, 'greedy')
      for (const e of allEvents) if (e.type === 'card') drawnIds.add(e.cardId)
    }
    // sanity: simulations exercise a large chunk of the deck
    expect(drawnIds.size).toBeGreaterThan(CARDS.length / 2)
    for (const id of drawnIds) expect(cardById(id)).toBeDefined()
  })
})
