import { careerById, houseById } from '@midlife/shared'
import type { PlayerState } from '@midlife/shared'
import { sendAction, trySpin } from '../net/socket'
import { useStore } from '../state/store'
import { COLOR_HEX } from '../scene/carColors'

const money = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString()}`

function PlayerPanel({ p, isTurn, isMe }: { p: PlayerState; isTurn: boolean; isMe: boolean }) {
  return (
    <div className={`player-panel${isTurn ? ' turn' : ''}${p.retired ? ' retired' : ''}`}>
      <div className="pp-head">
        <span className="car-dot" style={{ background: COLOR_HEX[p.color] }} />
        <span className="pp-name">
          {p.name}
          {isMe ? ' (you)' : ''}
        </span>
        {!p.connected && <span title="disconnected">📴</span>}
        {p.retired && <span title="retired">🌴</span>}
        {p.skipTurns > 0 && <span title={`skips ${p.skipTurns} turn(s)`}>😵</span>}
      </div>
      <div className="pp-cash" data-testid={`cash-${p.name}`}>
        {money(p.cash)}
      </div>
      <div className="pp-meta">
        {p.careerId ? (
          <span title={careerById(p.careerId).title}>
            💼 {careerById(p.careerId).title} · {money(p.salary)}/payday
          </span>
        ) : (
          <span>🪪 unemployed (aspirational)</span>
        )}
      </div>
      <div className="pp-icons">
        {p.married && <span title="married">💍</span>}
        {p.kids > 0 && <span title={`${p.kids} kids`}>{'👶'.repeat(p.kids)}</span>}
        {p.houseId && <span title={houseById(p.houseId).title}>🏠</span>}
        {p.insured && <span title="insured">🛡️</span>}
        {p.debt > 0 && (
          <span className="pp-debt" title="debt due at retirement">
            🏦 {money(p.debt)}
          </span>
        )}
      </div>
    </div>
  )
}

export default function HUD() {
  const game = useStore((s) => s.game)!
  const room = useStore((s) => s.room)
  const session = useStore((s) => s.session)
  const banner = useStore((s) => s.banner)
  const animating = useStore((s) => s.animating)

  const current = game.players[game.turnSeat]
  const myId = session?.playerId
  const me = game.players.find((p) => p.id === myId)
  const myTurn = current.id === myId
  const canSpin = myTurn && game.phase === 'awaitSpin' && !animating

  return (
    <div className="hud">
      <div className="hud-top-left">
        <div className="hud-room">
          ROOM <b>{room?.code}</b>
        </div>
        <div className="hud-round">Round {game.round}</div>
      </div>

      {banner && (
        <div className="hud-banner" data-testid="banner">
          {banner}
        </div>
      )}

      <div className="hud-players">
        {game.players.map((p) => (
          <PlayerPanel key={p.id} p={p} isTurn={p.id === current.id} isMe={p.id === myId} />
        ))}
      </div>

      <div className="hud-bottom">
        {game.phase !== 'gameOver' &&
          (canSpin ? (
            <div className="hud-actions">
              <button className="btn btn-spin" onClick={trySpin} data-testid="spin-button">
                SPIN 🎡
              </button>
              {me && !me.retired && (
                <button
                  className="btn btn-ghost btn-loan"
                  onClick={() => sendAction({ type: 'loan' })}
                  title="Get $20k now, owe $25k at retirement"
                >
                  🏦 Take a $20k loan
                </button>
              )}
            </div>
          ) : (
            <div className="hud-wait" data-testid="turn-indicator">
              {animating
                ? '…'
                : game.phase === 'awaitChoice'
                  ? `${game.players.find((p) => p.id === game.pending?.playerId)?.name ?? '???'} is making life decisions…`
                  : `Waiting for ${current.name}…`}
            </div>
          ))}
      </div>
    </div>
  )
}
