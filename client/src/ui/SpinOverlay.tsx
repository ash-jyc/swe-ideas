import { useEffect, useMemo, useRef, useState } from 'react'
import { sendAction, trySpin } from '../net/socket'
import { useStore } from '../state/store'

const WEDGES = 10
const WEDGE_DEG = 36
const R = 190
const CX = 200
const CY = 200
const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7']

const FLICK_THRESHOLD = 200 // deg/s
const MIN_SPEED = 380
const MAX_SPEED = 1100
const LAND_MS = 1800

type Phase = 'closed' | 'ready' | 'waiting' | 'landing' | 'landed'

/** Point on the wheel rim at `deg` clockwise from 12 o'clock. */
function rim(deg: number, r = R): [number, number] {
  const rad = (deg * Math.PI) / 180
  return [CX + r * Math.sin(rad), CY - r * Math.cos(rad)]
}

function wedgePath(i: number): string {
  const [x0, y0] = rim(i * WEDGE_DEG)
  const [x1, y1] = rim((i + 1) * WEDGE_DEG)
  return `M ${CX} ${CY} L ${x0} ${y0} A ${R} ${R} 0 0 1 ${x1} ${y1} Z`
}

export default function SpinOverlay() {
  const game = useStore((s) => s.game)
  const session = useStore((s) => s.session)
  const animating = useStore((s) => s.animating)

  const [phase, setPhase] = useState<Phase>('closed')
  const [hint, setHint] = useState<string | null>(null)
  const [landedValue, setLandedValue] = useState<number | null>(null)

  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const rot = useRef(0)
  const vel = useRef(0)
  const baseSpinId = useRef(0)
  const waitStart = useRef(0)
  const landing = useRef<{ from: number; to: number; start: number; value: number } | null>(null)
  const wheelEl = useRef<HTMLDivElement>(null)
  const wrapEl = useRef<HTMLDivElement>(null)
  const drag = useRef<{
    on: boolean
    lastA: number
    cum: number
    moved: number
    downT: number
    samples: { cum: number; t: number }[]
  }>({ on: false, lastA: 0, cum: 0, moved: 0, downT: 0, samples: [] })

  const myTurn = !!game && !!session && game.players[game.turnSeat]?.id === session.playerId
  const shouldOpen = myTurn && game!.phase === 'awaitSpin' && !animating

  // open/close in the resting state; flick states persist through updates
  useEffect(() => {
    if (shouldOpen && phase === 'closed') {
      setPhase('ready')
      setLandedValue(null)
      setHint(null)
      vel.current = 0
    } else if (!shouldOpen && phase === 'ready' && !drag.current.on) {
      setPhase('closed')
    }
  }, [shouldOpen, phase])

  // auto-close after the landed flash
  useEffect(() => {
    if (phase !== 'landed') return
    const t = setTimeout(() => setPhase('closed'), 950)
    return () => clearTimeout(t)
  }, [phase])

  // physics loop
  const open = phase !== 'closed'
  useEffect(() => {
    if (!open) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      const ph = phaseRef.current
      if (ph === 'waiting') {
        vel.current *= 1 - 0.12 * dt
        rot.current += vel.current * dt
        const sp = useStore.getState().spinner
        if (sp && sp.spinId > baseSpinId.current) {
          const dir = vel.current >= 0 ? 1 : -1
          const targetMod = -((sp.value - 0.5) * WEDGE_DEG)
          const cur = rot.current
          const raw = dir > 0 ? targetMod - cur : cur - targetMod
          const dist = ((raw % 360) + 360) % 360 + 720
          landing.current = { from: cur, to: cur + dir * dist, start: now, value: sp.value }
          setPhase('landing')
        } else if (now - waitStart.current > 6000) {
          setPhase('ready') // server never answered; let them try again
        }
      } else if (ph === 'landing' && landing.current) {
        const l = landing.current
        const t = Math.min((now - l.start) / LAND_MS, 1)
        const e = 1 - Math.pow(1 - t, 3)
        rot.current = l.from + (l.to - l.from) * e
        if (t >= 1) {
          setLandedValue(l.value)
          setPhase('landed')
        }
      }
      if (wheelEl.current) {
        wheelEl.current.style.transform = `rotate(${rot.current}deg)`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [open])

  const angleOf = (e: React.PointerEvent): number => {
    const box = wrapEl.current!.getBoundingClientRect()
    const dx = e.clientX - (box.left + box.width / 2)
    const dy = e.clientY - (box.top + box.height / 2)
    return (Math.atan2(dx, -dy) * 180) / Math.PI
  }

  const commitFlick = (speed: number) => {
    vel.current = Math.sign(speed || 1) * Math.min(Math.max(Math.abs(speed), MIN_SPEED), MAX_SPEED)
    baseSpinId.current = useStore.getState().spinner?.spinId ?? 0
    waitStart.current = performance.now()
    setHint(null)
    setPhase('waiting')
    trySpin()
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (phaseRef.current !== 'ready') return
    try {
      wrapEl.current?.setPointerCapture(e.pointerId)
    } catch {
      // synthetic/exotic pointers can't be captured; dragging still works
    }
    drag.current = {
      on: true,
      lastA: angleOf(e),
      cum: 0,
      moved: 0,
      downT: e.timeStamp,
      samples: [{ cum: 0, t: e.timeStamp }],
    }
    vel.current = 0
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const d0 = drag.current
    if (!d0.on) return
    const a = angleOf(e)
    let d = a - d0.lastA
    while (d > 180) d -= 360
    while (d < -180) d += 360
    rot.current += d
    d0.cum += d
    d0.moved += Math.abs(d)
    d0.lastA = a
    // velocity samples use event timeStamps: robust to slow render frames
    d0.samples.push({ cum: d0.cum, t: e.timeStamp })
    while (d0.samples.length > 2 && e.timeStamp - d0.samples[0].t > 250) d0.samples.shift()
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const d0 = drag.current
    if (!d0.on) return
    d0.on = false
    if (phaseRef.current !== 'ready') return
    // released velocity = angle covered over the trailing ~140ms window;
    // if the browser coalesced events into one frame (laggy devices), fall
    // back to the whole-gesture average so the flick still counts
    const tEnd = e.timeStamp
    let ref = d0.samples[0]
    for (const s of d0.samples) {
      if (tEnd - s.t <= 140) break
      ref = s
    }
    const dtWin = tEnd - ref.t
    const winVel = dtWin > 0 ? ((d0.cum - ref.cum) / dtWin) * 1000 : 0
    const dtAll = tEnd - d0.downT
    const wholeVel = dtAll > 0 ? (d0.cum / dtAll) * 1000 : 0
    const flickVel = Math.abs(winVel) >= Math.abs(wholeVel) ? winVel : wholeVel
    if (Math.abs(flickVel) >= FLICK_THRESHOLD && d0.moved > 15) {
      commitFlick(flickVel)
    } else {
      vel.current = 0
      if (d0.moved > 4) {
        setHint('Weak. Give it a real flick! 💪')
        setTimeout(() => setHint(null), 1600)
      }
    }
  }

  const wheelSvg = useMemo(
    () => (
      <svg className="spin-wheel-svg" viewBox="0 0 400 400">
        {Array.from({ length: WEDGES }, (_, i) => (
          <g key={i}>
            <path d={wedgePath(i)} fill={COLORS[i % COLORS.length]} stroke="#0f172a" strokeWidth="3" />
            <text
              x={rim((i + 0.5) * WEDGE_DEG, 145)[0]}
              y={rim((i + 0.5) * WEDGE_DEG, 145)[1]}
              transform={`rotate(${(i + 0.5) * WEDGE_DEG} ${rim((i + 0.5) * WEDGE_DEG, 145)[0]} ${rim((i + 0.5) * WEDGE_DEG, 145)[1]})`}
              textAnchor="middle"
              dominantBaseline="central"
              className="spin-wheel-num"
            >
              {i + 1}
            </text>
          </g>
        ))}
        <circle cx={CX} cy={CY} r="34" fill="#f8fafc" stroke="#0f172a" strokeWidth="4" />
        <text x={CX} y={CY} textAnchor="middle" dominantBaseline="central" className="spin-wheel-hub">
          🎡
        </text>
      </svg>
    ),
    [],
  )

  if (phase === 'closed') return null

  return (
    <div className="spin-overlay" data-testid="spin-overlay">
      <div className="spin-title">
        {phase === 'landed' ? `YOU SPUN A ${landedValue}!` : 'YOUR TURN — FLICK THE WHEEL'}
      </div>
      <div
        ref={wrapEl}
        className="spin-wheel-wrap"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="spin-pointer" />
        <div ref={wheelEl} className="spin-wheel">
          {wheelSvg}
        </div>
        {phase === 'landed' && landedValue !== null && (
          <div className="spin-landed">{landedValue}</div>
        )}
      </div>
      <div className="spin-hint">{hint ?? (phase === 'ready' ? 'grab it and rip' : ' ')}</div>
      <div className="spin-footer">
        <button
          className="btn btn-ghost"
          data-testid="spin-button"
          disabled={phase !== 'ready'}
          onClick={() => phaseRef.current === 'ready' && commitFlick((Math.random() < 0.5 ? -1 : 1) * (600 + Math.random() * 350))}
        >
          just spin it for me
        </button>
        <button
          className="btn btn-ghost"
          disabled={phase !== 'ready'}
          onClick={() => sendAction({ type: 'loan' })}
          title="Get $20k now, owe $25k at retirement"
        >
          🏦 take a $20k loan
        </button>
      </div>
    </div>
  )
}
