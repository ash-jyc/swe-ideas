import { randomBytes, randomInt, randomUUID } from 'node:crypto'
import type { Server, Socket } from 'socket.io'
import {
  CAR_COLORS,
  EngineError,
  applyAction,
  defaultOptionId,
  initGame,
  mulberry32,
  type CarColor,
  type GameAction,
  type GameEvent,
  type GameState,
  type RoomAck,
  type RoomSnapshot,
  type Rng,
} from '@midlife/shared'

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ'
const AUTO_ACT_DELAY_MS = 4_000
const EMPTY_ROOM_TTL_MS = 30 * 60 * 1000

interface RoomPlayer {
  token: string // secret, identifies the human across reconnects
  playerId: string // public id used in game state
  name: string
  color: CarColor
  connected: boolean
  socketId: string | null
}

interface Room {
  code: string
  hostToken: string
  phase: 'lobby' | 'playing'
  players: RoomPlayer[]
  game: GameState | null
  rng: Rng
  autoTimer: ReturnType<typeof setTimeout> | null
  destroyTimer: ReturnType<typeof setTimeout> | null
}

type AnySocket = Socket

export class RoomManager {
  private rooms = new Map<string, Room>()

  constructor(private io: Server) {}

  // ---- lifecycle ----------------------------------------------------------

  create(socket: AnySocket, name: string, ack: (res: RoomAck) => void) {
    let code = this.genCode()
    while (this.rooms.has(code)) code = this.genCode()
    const room: Room = {
      code,
      hostToken: '',
      phase: 'lobby',
      players: [],
      game: null,
      rng: mulberry32(randomInt(2 ** 31)),
      autoTimer: null,
      destroyTimer: null,
    }
    this.rooms.set(code, room)
    const player = this.addPlayer(room, socket, name)
    room.hostToken = player.token
    ack({ ok: true, code, token: player.token, playerId: player.playerId })
    this.broadcastRoom(room)
  }

  join(socket: AnySocket, code: string, name: string, ack: (res: RoomAck) => void) {
    const room = this.rooms.get(code.toUpperCase().trim())
    if (!room) return ack({ ok: false, error: 'No room with that code.' })
    if (room.phase === 'playing') return ack({ ok: false, error: 'That game already started.' })
    if (room.players.length >= 6) return ack({ ok: false, error: 'Room is full (6 players max).' })
    const player = this.addPlayer(room, socket, name)
    ack({ ok: true, code: room.code, token: player.token, playerId: player.playerId })
    this.broadcastRoom(room)
  }

  resume(socket: AnySocket, code: string, token: string, ack: (res: RoomAck) => void) {
    const room = this.rooms.get(code?.toUpperCase?.().trim?.() ?? '')
    const player = room?.players.find((p) => p.token === token)
    if (!room || !player) return ack({ ok: false, error: 'Session expired.' })
    player.connected = true
    player.socketId = socket.id
    socket.data.code = room.code
    socket.data.token = token
    socket.join(room.code)
    this.clearDestroyTimer(room)
    if (room.game) {
      const gp = room.game.players.find((p) => p.id === player.playerId)
      if (gp) gp.connected = true
    }
    ack({ ok: true, code: room.code, token, playerId: player.playerId })
    this.broadcastRoom(room)
    if (room.game) {
      socket.emit('game:update', { state: this.publicState(room.game), events: [] })
      this.scheduleAuto(room)
    }
  }

  disconnect(socket: AnySocket) {
    const room = this.roomOf(socket)
    if (!room) return
    const player = room.players.find((p) => p.socketId === socket.id)
    if (!player) return
    player.connected = false
    player.socketId = null

    if (room.phase === 'lobby') {
      room.players = room.players.filter((p) => p !== player)
      if (room.players.length === 0) return this.destroyRoom(room)
      if (room.hostToken === player.token) room.hostToken = room.players[0].token
      this.broadcastRoom(room)
      return
    }

    // mid-game: keep the seat, auto-resolve their turns
    if (room.game) {
      const gp = room.game.players.find((p) => p.id === player.playerId)
      if (gp) gp.connected = false
      this.io.to(room.code).emit('game:update', { state: this.publicState(room.game), events: [] })
    }
    this.broadcastRoom(room)
    this.scheduleAuto(room)
    if (room.players.every((p) => !p.connected)) {
      this.clearDestroyTimer(room)
      room.destroyTimer = setTimeout(() => this.destroyRoom(room), EMPTY_ROOM_TTL_MS)
    }
  }

  // ---- lobby --------------------------------------------------------------

  setColor(socket: AnySocket, color: CarColor) {
    const { room, player } = this.ctx(socket)
    if (room.phase !== 'lobby') throw new EngineError('Colors lock once the game starts.')
    if (!CAR_COLORS.includes(color)) throw new EngineError('Not a color.')
    if (room.players.some((p) => p !== player && p.color === color)) {
      throw new EngineError('Someone already grabbed that car.')
    }
    player.color = color
    this.broadcastRoom(room)
  }

  start(socket: AnySocket) {
    const { room, player } = this.ctx(socket)
    if (room.hostToken !== player.token) throw new EngineError('Only the host can start.')
    if (room.phase !== 'lobby') throw new EngineError('Already started.')
    if (room.players.length < 2) throw new EngineError('You need at least 2 players.')
    room.phase = 'playing'
    room.game = initGame(
      room.players.map((p) => ({ id: p.playerId, name: p.name, color: p.color })),
      room.rng,
    )
    for (const gp of room.game.players) {
      const rp = room.players.find((p) => p.playerId === gp.id)
      gp.connected = rp?.connected ?? false
    }
    this.broadcastRoom(room)
    this.broadcastGame(room, [{ type: 'turn', playerId: room.game.players[0].id }])
  }

  toLobby(socket: AnySocket) {
    const { room, player } = this.ctx(socket)
    if (room.hostToken !== player.token) throw new EngineError('Only the host can do that.')
    if (room.phase !== 'playing') return
    this.clearAutoTimer(room)
    room.phase = 'lobby'
    room.game = null
    // drop anyone who disconnected during the game
    room.players = room.players.filter((p) => p.connected)
    if (room.players.length === 0) return this.destroyRoom(room)
    if (!room.players.some((p) => p.token === room.hostToken)) {
      room.hostToken = room.players[0].token
    }
    this.broadcastRoom(room)
  }

  // ---- game actions -------------------------------------------------------

  action(socket: AnySocket, action: GameAction) {
    const { room, player } = this.ctx(socket)
    if (!room.game) throw new EngineError('No game running.')
    const result = applyAction(room.game, player.playerId, action, room.rng)
    room.game = result.state
    this.syncConnected(room)
    this.broadcastGame(room, result.events)
  }

  // ---- internals ----------------------------------------------------------

  private addPlayer(room: Room, socket: AnySocket, rawName: string): RoomPlayer {
    const name = (rawName ?? '').trim().slice(0, 16) || `Player ${room.players.length + 1}`
    const used = new Set(room.players.map((p) => p.color))
    const color = CAR_COLORS.find((c) => !used.has(c)) ?? 'red'
    const player: RoomPlayer = {
      token: randomUUID(),
      playerId: randomBytes(4).toString('hex'),
      name,
      color,
      connected: true,
      socketId: socket.id,
    }
    room.players.push(player)
    socket.data.code = room.code
    socket.data.token = player.token
    socket.join(room.code)
    this.clearDestroyTimer(room)
    return player
  }

  private ctx(socket: AnySocket): { room: Room; player: RoomPlayer } {
    const room = this.roomOf(socket)
    const player = room?.players.find((p) => p.token === socket.data.token)
    if (!room || !player) throw new EngineError('You are not in a room.')
    return { room, player }
  }

  private roomOf(socket: AnySocket): Room | undefined {
    return socket.data.code ? this.rooms.get(socket.data.code) : undefined
  }

  private syncConnected(room: Room) {
    if (!room.game) return
    for (const gp of room.game.players) {
      const rp = room.players.find((p) => p.playerId === gp.id)
      gp.connected = rp?.connected ?? false
    }
  }

  private broadcastRoom(room: Room) {
    this.io.to(room.code).emit('room:state', this.snapshot(room))
  }

  private broadcastGame(room: Room, events: GameEvent[]) {
    if (!room.game) return
    this.io.to(room.code).emit('game:update', { state: this.publicState(room.game), events })
    this.scheduleAuto(room)
  }

  /** Strip the deck order so a clever client can't read the future. */
  private publicState(game: GameState): GameState {
    return { ...game, deck: [], deckPos: 0 }
  }

  private snapshot(room: Room): RoomSnapshot {
    return {
      code: room.code,
      phase: room.phase,
      players: room.players.map((p, i) => ({
        playerId: p.playerId,
        name: p.name,
        color: p.color,
        seat: i,
        connected: p.connected,
        isHost: p.token === room.hostToken,
      })),
    }
  }

  // ---- disconnected-player auto-resolution --------------------------------

  private scheduleAuto(room: Room) {
    this.clearAutoTimer(room)
    const game = room.game
    if (!game || game.phase === 'gameOver') return
    const actorId = game.pending?.playerId ?? game.players[game.turnSeat].id
    const rp = room.players.find((p) => p.playerId === actorId)
    if (rp?.connected) return
    room.autoTimer = setTimeout(() => this.autoAct(room, actorId), AUTO_ACT_DELAY_MS)
  }

  private autoAct(room: Room, expectedActorId: string) {
    const game = room.game
    if (!game || game.phase === 'gameOver') return
    const actorId = game.pending?.playerId ?? game.players[game.turnSeat].id
    if (actorId !== expectedActorId) return this.scheduleAuto(room)
    const rp = room.players.find((p) => p.playerId === actorId)
    if (rp?.connected) return
    const action: GameAction = game.pending
      ? { type: 'choose', optionId: defaultOptionId(game.pending, room.rng) }
      : { type: 'spin' }
    try {
      const result = applyAction(game, actorId, action, room.rng)
      room.game = result.state
      this.syncConnected(room)
      this.broadcastGame(room, result.events)
    } catch (err) {
      console.error(`[room ${room.code}] auto-act failed:`, err)
    }
  }

  private clearAutoTimer(room: Room) {
    if (room.autoTimer) clearTimeout(room.autoTimer)
    room.autoTimer = null
  }

  private clearDestroyTimer(room: Room) {
    if (room.destroyTimer) clearTimeout(room.destroyTimer)
    room.destroyTimer = null
  }

  private destroyRoom(room: Room) {
    this.clearAutoTimer(room)
    this.clearDestroyTimer(room)
    this.rooms.delete(room.code)
  }

  private genCode(): string {
    let code = ''
    for (let i = 0; i < 4; i++) code += CODE_CHARS[randomInt(CODE_CHARS.length)]
    return code
  }
}
