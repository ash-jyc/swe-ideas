import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { trySpin } from '../net/socket'
import { useStore } from '../state/store'
import { labelTexture } from './textTexture'

export const SPINNER_POS: [number, number, number] = [21, 0, 2]

const WEDGES = 10
const WEDGE_ANGLE = (Math.PI * 2) / WEDGES
const R = 4
const SPIN_MS = 1600
const EXTRA_TURNS = 4

const WEDGE_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7']

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

interface SpinAnim {
  spinId: number
  from: number
  to: number
  start: number
}

export default function Spinner() {
  const wheel = useRef<Group>(null)
  const anim = useRef<SpinAnim>({ spinId: 0, from: 0, to: 0, start: 0 })

  useFrame(() => {
    const w = wheel.current
    if (!w) return
    const sp = useStore.getState().spinner
    if (sp && sp.spinId !== anim.current.spinId) {
      // value v wedge center sits at angle (v-0.5)*WEDGE_ANGLE; rotate it to the
      // pointer at world +z (angle 0): target rotation = -center (mod 2pi)
      const center = (sp.value - 0.5) * WEDGE_ANGLE
      const base = ((-center % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
      const from = w.rotation.y % (Math.PI * 2)
      anim.current = {
        spinId: sp.spinId,
        from,
        to: from + EXTRA_TURNS * Math.PI * 2 + ((base - from + Math.PI * 2 * 3) % (Math.PI * 2)),
        start: performance.now(),
      }
    }
    const a = anim.current
    if (a.start > 0) {
      const t = Math.min((performance.now() - a.start) / SPIN_MS, 1)
      w.rotation.y = a.from + (a.to - a.from) * easeOutCubic(t)
    } else {
      w.rotation.y += 0.0015 // idle drift
    }
  })

  return (
    <group position={SPINNER_POS}>
      {/* pedestal */}
      <mesh position={[0, 0.35, 0]} receiveShadow>
        <cylinderGeometry args={[R + 0.9, R + 1.4, 0.7, 24]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
      {/* wheel */}
      <group ref={wheel} position={[0, 0.85, 0]} onClick={trySpin}>
        {Array.from({ length: WEDGES }, (_, i) => (
          <group key={i}>
            <mesh castShadow>
              <cylinderGeometry
                args={[R, R, 0.35, 6, 1, false, i * WEDGE_ANGLE, WEDGE_ANGLE]}
              />
              <meshStandardMaterial color={WEDGE_COLORS[i % WEDGE_COLORS.length]} />
            </mesh>
            {/* number */}
            <group rotation={[0, (i + 0.5) * WEDGE_ANGLE, 0]}>
              <mesh position={[0, 0.19, R * 0.68]} rotation={[-Math.PI / 2, 0, Math.PI]}>
                <planeGeometry args={[1.5, 1.1]} />
                <meshBasicMaterial
                  map={labelTexture(String(i + 1), { fg: '#0f172a', w: 128, h: 96, fontPx: 80 })}
                  transparent
                />
              </mesh>
            </group>
          </group>
        ))}
        {/* hub */}
        <mesh position={[0, 0.25, 0]}>
          <cylinderGeometry args={[0.5, 0.5, 0.3, 16]} />
          <meshStandardMaterial color="#f8fafc" />
        </mesh>
      </group>
      {/* pointer at +z */}
      <mesh position={[0, 1.15, R + 0.55]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.32, 1.1, 4]} />
        <meshStandardMaterial color="#f8fafc" />
      </mesh>
    </group>
  )
}
