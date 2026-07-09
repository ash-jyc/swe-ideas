import { io, type Socket } from 'socket.io-client'
import type {
  CarColor,
  ClientToServerEvents,
  GameAction,
  RoomAck,
  ServerToClientEvents,
} from '@midlife/shared'
import { enqueueUpdate, resetGameView, useStore, type Session } from '../state/store'

const SESSION_KEY = 'midlife-session'
const NAME_KEY = 'midlife-name'

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({
  transports: ['websocket', 'polling'],
})

export function savedName(): string {
  return localStorage.getItem(NAME_KEY) ?? ''
}

function saveSession(session: Session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  useStore.setState({ session })
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY)
  useStore.setState({ session: null, room: null })
  resetGameView()
}

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

socket.on('connect', () => {
  useStore.setState({ socketConnected: true })
  const session = loadSession()
  if (session) {
    socket.emit('session:resume', { code: session.code, token: session.token }, (res) => {
      if (res.ok) {
        saveSession({ code: res.code, token: res.token, playerId: res.playerId })
      } else {
        clearSession()
      }
    })
  }
})

socket.on('disconnect', () => {
  useStore.setState({ socketConnected: false })
})

socket.on('room:state', (snapshot) => {
  const prev = useStore.getState().room
  useStore.setState({ room: snapshot })
  if (snapshot.phase === 'lobby' && prev?.phase !== 'lobby') {
    resetGameView()
  }
})

socket.on('game:update', (update) => {
  enqueueUpdate(update)
})

socket.on('toast', (message) => {
  useStore.getState().pushToast(message)
})

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

function handleAck(res: RoomAck) {
  if (res.ok) {
    saveSession({ code: res.code, token: res.token, playerId: res.playerId })
  } else {
    useStore.getState().pushToast(res.error)
  }
}

export function createRoom(name: string) {
  localStorage.setItem(NAME_KEY, name)
  socket.emit('room:create', { name }, handleAck)
}

export function joinRoom(code: string, name: string) {
  localStorage.setItem(NAME_KEY, name)
  socket.emit('room:join', { code, name }, handleAck)
}

export function leaveRoom() {
  clearSession()
  socket.disconnect()
  socket.connect()
}

export function setColor(color: CarColor) {
  socket.emit('lobby:color', color)
}

export function startGame() {
  socket.emit('game:start')
}

export function backToLobby() {
  socket.emit('game:tolobby')
}

export function sendAction(action: GameAction) {
  socket.emit('game:action', action)
}

export function trySpin() {
  const { game, session, animating } = useStore.getState()
  if (!game || !session || animating) return
  if (game.phase !== 'awaitSpin') return
  if (game.players[game.turnSeat].id !== session.playerId) return
  sendAction({ type: 'spin' })
}
