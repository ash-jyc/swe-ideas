import { create } from 'zustand'
import { SPACES, cardById, careerById, houseById } from '@midlife/shared'
import type { GameEvent, GameState, GameUpdate, RoomSnapshot } from '@midlife/shared'

export const HOP_MS = 270

export interface Session {
  code: string
  token: string
  playerId: string
}

export interface CarAnim {
  from: number
  path: number[]
  start: number // performance.now()
  backward?: boolean
}

export interface DisplayCar {
  spaceId: number
  anim?: CarAnim
}

export interface FxEvent {
  id: number
  kind: 'confetti' | 'smoke'
  pos: [number, number, number]
}

export interface Toast {
  id: number
  text: string
}

interface StoreState {
  socketConnected: boolean
  session: Session | null
  room: RoomSnapshot | null
  game: GameState | null
  /** true while the animation director is replaying events */
  animating: boolean
  display: Record<string, DisplayCar>
  activeCardId: string | null
  banner: string | null
  spinner: { value: number; spinId: number } | null
  fx: FxEvent[]
  shakeAt: number
  toasts: Toast[]
  dismissCard: () => void
  pushToast: (text: string) => void
}

export const useStore = create<StoreState>((set) => ({
  socketConnected: false,
  session: null,
  room: null,
  game: null,
  animating: false,
  display: {},
  activeCardId: null,
  banner: null,
  spinner: null,
  fx: [],
  shakeAt: 0,
  toasts: [],
  dismissCard: () => {
    cardResolver?.()
  },
  pushToast: (text: string) => {
    const id = ++idCounter
    set((s) => ({ toasts: [...s.toasts, { id, text }] }))
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
    }, 4200)
  },
}))

let idCounter = 0
let cardResolver: (() => void) | null = null

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

function carWorldPos(playerId: string): [number, number, number] {
  const d = useStore.getState().display[playerId]
  const g = useStore.getState().game
  const spaceId = d?.spaceId ?? g?.players.find((p) => p.id === playerId)?.position ?? 0
  const [x, y, z] = SPACES[spaceId].pos
  return [x, y + 1, z]
}

function addFx(kind: FxEvent['kind'], pos: [number, number, number]) {
  const id = ++idCounter
  useStore.setState((s) => ({ fx: [...s.fx, { id, kind, pos }] }))
  setTimeout(() => {
    useStore.setState((s) => ({ fx: s.fx.filter((f) => f.id !== id) }))
  }, 3000)
}

// ---------------------------------------------------------------------------
// Animation director: replays server event lists sequentially, then applies
// the authoritative snapshot. HUD money/choices only update once the dice
// have visibly landed.
// ---------------------------------------------------------------------------

const queue: GameUpdate[] = []
let pumping = false

export function enqueueUpdate(update: GameUpdate) {
  queue.push(update)
  void pump()
}

export function resetGameView() {
  queue.length = 0
  useStore.setState({
    game: null,
    display: {},
    activeCardId: null,
    banner: null,
    spinner: null,
    animating: false,
    fx: [],
  })
}

async function pump() {
  if (pumping) return
  pumping = true
  useStore.setState({ animating: true })
  try {
    while (queue.length) {
      const { state, events } = queue.shift()!
      for (const e of events) {
        await playEvent(e, state)
      }
      applySnapshot(state)
    }
  } finally {
    pumping = false
    useStore.setState({ animating: false })
  }
}

function applySnapshot(state: GameState) {
  const display: Record<string, DisplayCar> = {}
  for (const p of state.players) display[p.id] = { spaceId: p.position }
  useStore.setState({ game: state, display })
}

function nameOf(state: GameState, playerId: string): string {
  return state.players.find((p) => p.id === playerId)?.name ?? '???'
}

const fmtMoney = (n: number) =>
  `${n < 0 ? '-' : '+'}$${Math.abs(n).toLocaleString()}`

async function playEvent(e: GameEvent, state: GameState) {
  const set = useStore.setState
  switch (e.type) {
    case 'spin': {
      set({ banner: `🎡 ${nameOf(state, e.playerId)} spins a ${e.value}!` })
      set((s) => ({ spinner: { value: e.value, spinId: (s.spinner?.spinId ?? 0) + 1 } }))
      await sleep(1900)
      return
    }
    case 'move': {
      const cur = useStore.getState().display[e.playerId]
      const from =
        cur?.spaceId ?? state.players.find((p) => p.id === e.playerId)?.history[0] ?? 0
      set((s) => ({
        display: {
          ...s.display,
          [e.playerId]: {
            spaceId: e.path[e.path.length - 1],
            anim: { from, path: e.path, start: performance.now(), backward: e.backward },
          },
        },
      }))
      await sleep(e.path.length * HOP_MS + 180)
      set((s) => ({
        display: { ...s.display, [e.playerId]: { spaceId: e.path[e.path.length - 1] } },
      }))
      return
    }
    case 'payday':
      set({
        banner: `💰 PAYDAY${e.landed ? ' (landed — overtime bonus!)' : ''}: ${nameOf(state, e.playerId)} ${fmtMoney(e.amount)}`,
      })
      await sleep(850)
      return
    case 'card': {
      set({ activeCardId: e.cardId, banner: null })
      await new Promise<void>((resolve) => {
        let done = false
        const finish = () => {
          if (done) return
          done = true
          cardResolver = null
          resolve()
        }
        cardResolver = finish
        setTimeout(finish, 6000)
      })
      set({ activeCardId: null })
      await sleep(150)
      return
    }
    case 'cash':
      set({ banner: `${e.delta >= 0 ? '🤑' : '💸'} ${nameOf(state, e.playerId)}: ${fmtMoney(e.delta)} (${e.reason})` })
      await sleep(900)
      return
    case 'loan':
      set({
        banner: e.auto
          ? `🏦 ${nameOf(state, e.playerId)} is broke — forced loan: +$${(e.cash / 1000).toFixed(0)}k cash, $${(e.debt / 1000).toFixed(0)}k debt`
          : e.cash > 0
            ? `🏦 ${nameOf(state, e.playerId)} takes a loan: +$${(e.cash / 1000).toFixed(0)}k cash, $${(e.debt / 1000).toFixed(0)}k debt`
            : `🎓 ${nameOf(state, e.playerId)} takes on $${(e.debt / 1000).toFixed(0)}k of debt`,
      })
      await sleep(1100)
      return
    case 'marry':
      addFx('confetti', carWorldPos(e.playerId))
      set({ banner: `💍 ${nameOf(state, e.playerId)} got married!` })
      await sleep(1500)
      return
    case 'divorce':
      set({ banner: `💔 ${nameOf(state, e.playerId)} is divorced. The lawyers thank them.` })
      await sleep(1300)
      return
    case 'kid':
      set({ banner: `👶 ${nameOf(state, e.playerId)} has ${e.count} kid${e.count > 1 ? 's' : ''} now!` })
      await sleep(1100)
      return
    case 'crash':
      useStore.setState({ shakeAt: performance.now() })
      addFx('smoke', carWorldPos(e.playerId))
      set({
        banner: e.covered
          ? `🚗💥 ${nameOf(state, e.playerId)} crashed — insurance finally pays out!`
          : `🚗💥 ${nameOf(state, e.playerId)} crashed. No insurance. Ouch.`,
      })
      await sleep(1400)
      return
    case 'career': {
      const title = state.players.find((p) => p.id === e.playerId)
        ? `💼 ${nameOf(state, e.playerId)} is now: ${careerTitle(e.careerId)}`
        : ''
      set({ banner: title })
      await sleep(1200)
      return
    }
    case 'house':
      set({ banner: `🏠 ${nameOf(state, e.playerId)} bought: ${houseTitle(e.houseId)}` })
      await sleep(1200)
      return
    case 'insurance':
      set({ banner: `🛡️ ${nameOf(state, e.playerId)} is insured. Adulting unlocked.` })
      await sleep(900)
      return
    case 'gamble':
      set({
        banner: e.won
          ? `🎰 ${nameOf(state, e.playerId)} rolled ${e.roll} — WON ${fmtMoney(e.bet * 1.5)}!`
          : `🎰 ${nameOf(state, e.playerId)} rolled ${e.roll} — lost ${fmtMoney(-e.bet)}`,
      })
      await sleep(1500)
      return
    case 'skip':
      set({ banner: `😵 ${nameOf(state, e.playerId)} loses a turn` })
      await sleep(1000)
      return
    case 'retire':
      addFx('confetti', carWorldPos(e.playerId))
      set({
        banner: `🌴 ${nameOf(state, e.playerId)} retired with $${e.netWorth.toLocaleString()}!`,
      })
      await sleep(1600)
      return
    case 'turn':
      set({ banner: `🎲 ${nameOf(state, e.playerId)}'s turn` })
      await sleep(650)
      return
    case 'choice':
      set({ banner: `🤔 ${nameOf(state, e.playerId)} is deciding...` })
      await sleep(400)
      return
    case 'gameOver':
      await sleep(400)
      return
  }
}

function careerTitle(id: string): string {
  try {
    return careerById(id).title
  } catch {
    return id
  }
}
function houseTitle(id: string): string {
  try {
    return houseById(id).title
  } catch {
    return id
  }
}

export function activeCard() {
  const id = useStore.getState().activeCardId
  return id ? cardById(id) : null
}
