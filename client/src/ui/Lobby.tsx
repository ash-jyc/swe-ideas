import { CAR_COLORS } from '@midlife/shared'
import { leaveRoom, setColor, startGame } from '../net/socket'
import { useStore } from '../state/store'
import { COLOR_HEX } from '../scene/carColors'

export default function Lobby() {
  const room = useStore((s) => s.room)!
  const session = useStore((s) => s.session)

  const me = room.players.find((p) => p.playerId === session?.playerId)
  const isHost = me?.isHost ?? false
  const takenColors = new Set(room.players.map((p) => p.color))

  return (
    <div className="home">
      <div className="home-card lobby-card">
        <p className="lobby-kicker">ROOM CODE — tell your friends</p>
        <div className="room-code" data-testid="room-code">
          {room.code}
        </div>

        <div className="lobby-players" data-testid="lobby-players">
          {room.players.map((p) => (
            <div key={p.playerId} className={`lobby-player${p.connected ? '' : ' offline'}`}>
              <span className="car-dot" style={{ background: COLOR_HEX[p.color] }} />
              <span className="lobby-player-name">
                {p.name}
                {p.playerId === session?.playerId ? ' (you)' : ''}
              </span>
              {p.isHost && <span className="host-badge">HOST</span>}
              {!p.connected && <span className="offline-badge">offline</span>}
            </div>
          ))}
          {room.players.length < 6 && (
            <div className="lobby-player empty">waiting for more disappointments…</div>
          )}
        </div>

        <div className="color-picker">
          <span className="picker-label">Your car:</span>
          {CAR_COLORS.map((c) => (
            <button
              key={c}
              className={`color-swatch${me?.color === c ? ' selected' : ''}`}
              style={{ background: COLOR_HEX[c] }}
              disabled={takenColors.has(c) && me?.color !== c}
              onClick={() => setColor(c)}
              title={c}
            />
          ))}
        </div>

        {isHost ? (
          <button
            className="btn btn-primary btn-big"
            disabled={room.players.length < 2}
            onClick={startGame}
            data-testid="start-game"
          >
            {room.players.length < 2 ? 'Need at least 2 players' : `Start with ${room.players.length} players`}
          </button>
        ) : (
          <p className="waiting-note">Waiting for the host to start…</p>
        )}

        <button className="btn btn-ghost" onClick={leaveRoom}>
          Leave room
        </button>
      </div>
    </div>
  )
}
