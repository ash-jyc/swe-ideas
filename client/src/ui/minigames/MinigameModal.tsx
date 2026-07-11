import { useEffect, useRef, useState } from 'react'
import type { MinigameTier, PendingChoice } from '@midlife/shared'
import { sendAction } from '../../net/socket'

type Tier = MinigameTier

const RESULT_TEXT: Record<Tier, { text: string; cls: string }> = {
  great: { text: 'NAILED IT 🏆', cls: 'great' },
  ok: { text: 'that was… fine', cls: 'ok' },
  fail: { text: 'CATASTROPHE 💀', cls: 'fail' },
}

// ---------------------------------------------------------------------------
// Games — each reports a tier exactly once via onDone
// ---------------------------------------------------------------------------

function Reflex({ onDone }: { onDone: (t: Tier) => void }) {
  const [state, setState] = useState<'armed' | 'go'>('armed')
  const goAt = useRef(0)
  const [latency, setLatency] = useState<number | null>(null)

  useEffect(() => {
    const t = setTimeout(() => {
      goAt.current = performance.now()
      setState('go')
    }, 1200 + Math.random() * 2600)
    return () => clearTimeout(t)
  }, [])

  const tap = () => {
    if (state === 'armed') return onDone('fail') // flinched early
    const ms = performance.now() - goAt.current
    setLatency(Math.round(ms))
    onDone(ms <= 350 ? 'great' : ms <= 750 ? 'ok' : 'fail')
  }

  return (
    <>
      <button
        className={`mg-action ${state === 'armed' ? 'mg-armed' : 'mg-go'}`}
        data-testid="minigame-action"
        onPointerDown={tap}
      >
        {state === 'armed' ? 'WAIT FOR IT…' : 'CATCH!!'}
      </button>
      {latency !== null && <div className="mg-detail">{latency}ms</div>}
    </>
  )
}

const MASH_SECONDS = 5
const MASH_GREAT = 38
const MASH_OK = 18

function Mash({ onDone }: { onDone: (t: Tier) => void }) {
  const [taps, setTaps] = useState(0)
  const [left, setLeft] = useState(MASH_SECONDS)
  const tapsRef = useRef(0)
  const done = useRef(false)

  useEffect(() => {
    const start = performance.now()
    const iv = setInterval(() => {
      const rem = MASH_SECONDS - (performance.now() - start) / 1000
      setLeft(Math.max(rem, 0))
      if (rem <= 0 && !done.current) {
        done.current = true
        clearInterval(iv)
        const n = tapsRef.current
        onDone(n >= MASH_GREAT ? 'great' : n >= MASH_OK ? 'ok' : 'fail')
      }
    }, 80)
    return () => clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const tap = () => {
    tapsRef.current++
    setTaps(tapsRef.current)
  }

  return (
    <>
      <button className="mg-action mg-mash" data-testid="minigame-action" onPointerDown={tap}>
        MASH! ({taps})
      </button>
      <div className="mg-bar">
        <div
          className="mg-bar-fill"
          style={{ width: `${Math.min((taps / MASH_GREAT) * 100, 100)}%` }}
        />
      </div>
      <div className="mg-bar mg-bar-timer">
        <div className="mg-bar-fill timer" style={{ width: `${(left / MASH_SECONDS) * 100}%` }} />
      </div>
      <div className="mg-detail">{left.toFixed(1)}s</div>
    </>
  )
}

const TIMING_GREAT = 8 // distance from center (0-50 scale)
const TIMING_OK = 22

function Timing({ onDone }: { onDone: (t: Tier) => void }) {
  const [pos, setPos] = useState(50)
  const posRef = useRef(50)

  useEffect(() => {
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = (now - start) / 1000
      const p = 50 + 48 * Math.sin(t * 3.4)
      posRef.current = p
      setPos(p)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const stop = () => {
    const d = Math.abs(posRef.current - 50)
    onDone(d <= TIMING_GREAT ? 'great' : d <= TIMING_OK ? 'ok' : 'fail')
  }

  return (
    <>
      <div className="mg-track">
        <div className="mg-zone ok" />
        <div className="mg-zone great" />
        <div className="mg-marker" style={{ left: `${pos}%` }} />
      </div>
      <button className="mg-action mg-stop" data-testid="minigame-action" onPointerDown={stop}>
        STOP!
      </button>
    </>
  )
}

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

export default function MinigameModal({ pending }: { pending: PendingChoice }) {
  const mg = pending.minigame!
  const [stage, setStage] = useState<'countdown' | 'playing' | 'result'>('countdown')
  const [count, setCount] = useState(3)
  const [tier, setTier] = useState<Tier | null>(null)
  const submitted = useRef(false)

  useEffect(() => {
    if (stage !== 'countdown') return
    if (count === 0) {
      setStage('playing')
      return
    }
    const t = setTimeout(() => setCount((c) => c - 1), 750)
    return () => clearTimeout(t)
  }, [stage, count])

  const finish = (t: Tier) => {
    if (submitted.current) return
    submitted.current = true
    setTier(t)
    setStage('result')
    setTimeout(() => sendAction({ type: 'choose', optionId: t }), 1300)
  }

  // AFK watchdog: a connected-but-absent player shouldn't stall the table
  useEffect(() => {
    const t = setTimeout(() => finish('ok'), 18_000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="card-overlay mg-overlay" data-testid="minigame-modal">
      <div className="mg-panel">
        <div className="mg-kicker">🕹 MINI-GAME</div>
        <h2 className="mg-title">{mg.title}</h2>
        <p className="mg-instructions">{mg.instructions}</p>
        {stage === 'countdown' && <div className="mg-countdown">{count === 0 ? 'GO!' : count}</div>}
        {stage === 'playing' &&
          (mg.game === 'reflex' ? (
            <Reflex onDone={finish} />
          ) : mg.game === 'mash' ? (
            <Mash onDone={finish} />
          ) : (
            <Timing onDone={finish} />
          ))}
        {stage === 'result' && tier && (
          <div className={`mg-result ${RESULT_TEXT[tier].cls}`}>{RESULT_TEXT[tier].text}</div>
        )}
      </div>
    </div>
  )
}
