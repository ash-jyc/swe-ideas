import { useMemo, useState } from 'react'
import { createRoom, joinRoom, savedName } from '../net/socket'

const FLOATERS = ['💸', '💍', '👶', '🚗', '🎰', '📉', '💔', '🍸', '🏠', '🎓', '🧾', '⚖️', '🎟️', '📱']

export default function Home() {
  const [name, setName] = useState(savedName())
  const [code, setCode] = useState('')

  const canPlay = name.trim().length > 0

  const floaters = useMemo(
    () =>
      FLOATERS.map((emoji, i) => ({
        emoji,
        left: `${(i * 71) % 100}%`,
        delay: `${(i * 1.7) % 14}s`,
        duration: `${14 + ((i * 3) % 10)}s`,
        size: `${22 + ((i * 7) % 22)}px`,
      })),
    [],
  )

  return (
    <div className="home">
      <div className="home-floaters" aria-hidden>
        {floaters.map((f, i) => (
          <span
            key={i}
            className="floater"
            style={{ left: f.left, animationDelay: f.delay, animationDuration: f.duration, fontSize: f.size }}
          >
            {f.emoji}
          </span>
        ))}
      </div>
      <div className="home-card">
        <h1 className="logo">
          MIDLIFE<span className="logo-accent">CRISIS</span>
        </h1>
        <p className="tagline">The Game of Adult Life. Like the board game, but with student debt.</p>

        <label className="field">
          <span>Your name</span>
          <input
            value={name}
            maxLength={16}
            placeholder="e.g. Disappointment"
            onChange={(e) => setName(e.target.value)}
            data-testid="name-input"
          />
        </label>

        <button
          className="btn btn-primary btn-big"
          disabled={!canPlay}
          onClick={() => createRoom(name.trim())}
          data-testid="create-room"
        >
          Create a room
        </button>

        <div className="divider">
          <span>or join your friends</span>
        </div>

        <div className="join-row">
          <input
            className="code-input"
            value={code}
            maxLength={4}
            size={4}
            placeholder="CODE"
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            data-testid="code-input"
          />
          <button
            className="btn btn-secondary"
            disabled={!canPlay || code.trim().length !== 4}
            onClick={() => joinRoom(code.trim(), name.trim())}
            data-testid="join-room"
          >
            Join
          </button>
        </div>

        <p className="fine-print">2–6 players · online · contains adult life choices and their consequences</p>
      </div>
    </div>
  )
}
