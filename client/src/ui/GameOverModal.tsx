import { backToLobby } from '../net/socket'
import { useStore } from '../state/store'

const MEDALS = ['🏆', '🥈', '🥉', '4th', '5th', '6th']

export default function GameOverModal() {
  const game = useStore((s) => s.game)!
  const room = useStore((s) => s.room)
  const session = useStore((s) => s.session)

  const ranking = game.ranking ?? []
  const isHost = room?.players.find((p) => p.playerId === session?.playerId)?.isHost ?? false

  return (
    <div className="card-overlay" data-testid="game-over">
      <div className="gameover-panel">
        <h2 className="gameover-title">LIFE, COMPLETED</h2>
        <p className="gameover-sub">Net worth at retirement. That’s it. That’s the score.</p>
        <div className="gameover-ranking">
          {ranking.map((r, i) => (
            <div key={r.playerId} className={`rank-row${i === 0 ? ' winner' : ''}`}>
              <span className="rank-medal">{MEDALS[i] ?? `${i + 1}th`}</span>
              <span className="rank-name">{r.name}</span>
              <span className={`rank-worth${r.netWorth < 0 ? ' bad' : ''}`}>
                {r.netWorth < 0 ? '-' : ''}${Math.abs(r.netWorth).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
        {isHost ? (
          <button className="btn btn-primary" onClick={backToLobby} data-testid="back-to-lobby">
            Back to lobby
          </button>
        ) : (
          <p className="waiting-note">Waiting for the host…</p>
        )}
      </div>
    </div>
  )
}
