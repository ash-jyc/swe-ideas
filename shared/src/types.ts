// ---------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------

export type SpaceType =
  | 'START'
  | 'EVENT'
  | 'PAYDAY'
  | 'TAX'
  | 'GAMBLE'
  | 'LOTTERY'
  | 'BABY'
  | 'CRASH'
  | 'STOP_CAREER'
  | 'STOP_MARRIAGE'
  | 'STOP_HOUSE'
  | 'RETIREMENT'

export type BranchName = 'main' | 'college' | 'work' | 'risky' | 'safe'

export interface ForkOption {
  label: string
  detail: string
  next: number
  /** Debt (owed at retirement) incurred by picking this path, e.g. student loans. */
  debt?: number
}

export interface Space {
  id: number
  type: SpaceType
  /** Successor space ids. Two entries = fork (player chooses when passing through). */
  next: number[]
  pos: [number, number, number]
  branch: BranchName
  label?: string
  /** STOP_CAREER: which career pool to draw from. */
  collegePool?: boolean
  /** BABY spaces: how many pegs arrive (default 1; the TWINS space says 2). */
  babyCount?: number
  /** Present when next.length > 1. */
  forkOptions?: ForkOption[]
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

export interface Career {
  id: string
  title: string
  /** Collected at each PAYDAY. */
  salary: number
  college: boolean
  flavor: string
}

export interface House {
  id: string
  title: string
  price: number
  /** Counted toward net worth at retirement. */
  resale: number
  flavor: string
}

export type CardCategory =
  | 'relationships'
  | 'vices'
  | 'money'
  | 'internet'
  | 'news'
  | 'career'
  | 'health'

export type CardRequires =
  | 'married'
  | 'single'
  | 'kids'
  | 'career'
  | 'house'
  | 'insured'
  | 'divorced'
  | 'renter'
  | 'debt'

export interface CardEffect {
  cash?: number
  /** Percent of CURRENT cash gained/lost (e.g. -40 = lose 40%). Scales with wealth. */
  cashPct?: number
  cashPerKid?: number
  /** Percentage change to salary, e.g. 20 = +20%, -10 = -10%. */
  salaryPct?: number
  /** Extra debt owed at retirement (positive) or forgiven (negative). */
  debt?: number
  /** Move forward (positive, resolves the landing) or backward (negative, inert landing). */
  move?: number
  skipTurn?: boolean
  marry?: boolean
  divorce?: boolean
  /** % of cash lost when divorce fires (default 50). */
  divorcePct?: number
  kids?: number
  insurance?: boolean
  loseInsurance?: boolean
  /** Forced career change: draw one random new career. */
  newCareer?: boolean
  collectFromEach?: number
  payToEach?: number
  /** 50/50 coin flip resolved by the engine. */
  gamble?: { win: number; lose: number }
  /** 50/50 coin flip over a PERCENT of current cash (e.g. {win:50, lose:50}). */
  gamblePct?: { win: number; lose: number }
}

export interface CardChoiceOption {
  id: string
  label: string
  effect: CardEffect
}

export type MinigameId = 'reflex' | 'mash' | 'timing'
export type MinigameTier = 'great' | 'ok' | 'fail'

export interface CardMinigame {
  game: MinigameId
  instructions: string
  tiers: Record<MinigameTier, CardEffect>
}

export interface EventCard {
  id: string
  category: CardCategory
  title: string
  flavor: string
  requires?: CardRequires
  effect?: CardEffect
  choice?: { prompt: string; options: CardChoiceOption[] }
  /** A playable mini-game decides which tier effect applies. */
  minigame?: CardMinigame
}

// ---------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------

export const CAR_COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'] as const
export type CarColor = (typeof CAR_COLORS)[number]

export interface PlayerState {
  id: string
  name: string
  color: CarColor
  seat: number
  position: number
  /** Space ids visited, starting with START. Used for backward moves. */
  history: number[]
  cash: number
  debt: number
  salary: number
  careerId: string | null
  houseId: string | null
  married: boolean
  divorced: boolean
  kids: number
  insured: boolean
  retired: boolean
  skipTurns: number
  connected: boolean
}

export type ChoiceKind =
  | 'fork'
  | 'career'
  | 'marriage'
  | 'house'
  | 'houseSell'
  | 'gamble'
  | 'lottery'
  | 'card'
  | 'insurance'
  | 'minigame'

export interface ChoiceOption {
  id: string
  label: string
  detail?: string
}

export interface PendingChoice {
  kind: ChoiceKind
  playerId: string
  prompt: string
  options: ChoiceOption[]
  /** fork: steps remaining after the fork space. */
  remaining?: number
  cardId?: string
  /** minigame: what the acting player's client should run. */
  minigame?: { game: MinigameId; title: string; instructions: string }
}

export type GamePhase = 'awaitSpin' | 'awaitChoice' | 'gameOver'

export interface RankEntry {
  playerId: string
  name: string
  netWorth: number
}

export interface GameState {
  phase: GamePhase
  players: PlayerState[]
  turnSeat: number
  round: number
  pending: PendingChoice | null
  /** Shuffled event-card ids; deckPos points at the next draw. */
  deck: string[]
  deckPos: number
  ranking?: RankEntry[]
}

// ---------------------------------------------------------------------------
// Engine actions & animation events
// ---------------------------------------------------------------------------

export type GameAction =
  | { type: 'spin' }
  | { type: 'choose'; optionId: string }
  | { type: 'loan' }

export type GameEvent =
  | { type: 'spin'; playerId: string; value: number }
  | { type: 'move'; playerId: string; path: number[]; backward?: boolean }
  | { type: 'payday'; playerId: string; amount: number; landed?: boolean }
  | { type: 'card'; playerId: string; cardId: string }
  | { type: 'cash'; playerId: string; delta: number; reason: string }
  | { type: 'loan'; playerId: string; cash: number; debt: number; auto: boolean }
  | { type: 'marry'; playerId: string }
  | { type: 'divorce'; playerId: string }
  | { type: 'kid'; playerId: string; count: number }
  | { type: 'crash'; playerId: string; covered: boolean }
  | { type: 'career'; playerId: string; careerId: string }
  | { type: 'house'; playerId: string; houseId: string }
  | { type: 'insurance'; playerId: string }
  | { type: 'gamble'; playerId: string; bet: number; roll: number; won: boolean }
  | { type: 'lottery'; playerId: string; spend: number; roll: number; won: boolean; prize: number }
  | { type: 'skip'; playerId: string }
  | { type: 'retire'; playerId: string; netWorth: number }
  | { type: 'turn'; playerId: string }
  | { type: 'choice'; playerId: string; prompt: string }
  | { type: 'gameOver'; ranking: RankEntry[] }

// ---------------------------------------------------------------------------
// Net protocol (Socket.IO)
// ---------------------------------------------------------------------------

export interface LobbyPlayer {
  playerId: string
  name: string
  color: CarColor
  seat: number
  connected: boolean
  isHost: boolean
}

export type RoomPhase = 'lobby' | 'playing'

export interface RoomSnapshot {
  code: string
  phase: RoomPhase
  players: LobbyPlayer[]
}

export interface GameUpdate {
  state: GameState
  events: GameEvent[]
}

export type RoomAck =
  | { ok: true; code: string; token: string; playerId: string }
  | { ok: false; error: string }

export interface ServerToClientEvents {
  'room:state': (snapshot: RoomSnapshot) => void
  'game:update': (update: GameUpdate) => void
  toast: (message: string) => void
}

export interface ClientToServerEvents {
  'room:create': (req: { name: string }, ack: (res: RoomAck) => void) => void
  'room:join': (req: { code: string; name: string }, ack: (res: RoomAck) => void) => void
  'session:resume': (req: { code: string; token: string }, ack: (res: RoomAck) => void) => void
  'lobby:color': (color: CarColor) => void
  'game:start': () => void
  'game:action': (action: GameAction) => void
  'game:tolobby': () => void
}
