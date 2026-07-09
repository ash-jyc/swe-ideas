import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Group } from 'three'
import { SPACES, mulberry32 } from '@midlife/shared'
import { labelTexture } from './textTexture'

const SPINNER_POS: [number, number, number] = [21, 0, 2]

function Tree({ pos, pine, s }: { pos: [number, number, number]; pine: boolean; s: number }) {
  return (
    <group position={pos} scale={s}>
      <mesh position={[0, 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.22, 1, 6]} />
        <meshStandardMaterial color="#7c4a21" />
      </mesh>
      {pine ? (
        <>
          <mesh position={[0, 1.5, 0]} castShadow>
            <coneGeometry args={[0.9, 1.6, 7]} />
            <meshStandardMaterial color="#2f7a44" />
          </mesh>
          <mesh position={[0, 2.4, 0]} castShadow>
            <coneGeometry args={[0.6, 1.2, 7]} />
            <meshStandardMaterial color="#3e8948" />
          </mesh>
        </>
      ) : (
        <mesh position={[0, 1.7, 0]} castShadow>
          <sphereGeometry args={[1, 8, 6]} />
          <meshStandardMaterial color="#4a9b52" flatShading />
        </mesh>
      )}
    </group>
  )
}

function Chapel({ pos }: { pos: [number, number, number] }) {
  return (
    <group position={pos}>
      <mesh position={[0, 1.4, 0]} castShadow>
        <boxGeometry args={[3, 2.8, 3.6]} />
        <meshStandardMaterial color="#f8fafc" />
      </mesh>
      <mesh position={[0, 3.4, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[2.6, 1.6, 4]} />
        <meshStandardMaterial color="#b91c1c" />
      </mesh>
      <mesh position={[0, 2.2, 1.85]}>
        <planeGeometry args={[1.4, 1.4]} />
        <meshBasicMaterial map={labelTexture('♥', { fg: '#ec4899', fontPx: 110, w: 128, h: 128 })} transparent />
      </mesh>
    </group>
  )
}

function Casino({ pos }: { pos: [number, number, number] }) {
  return (
    <group position={pos}>
      <mesh position={[0, 1.6, 0]} castShadow>
        <boxGeometry args={[4.4, 3.2, 3.4]} />
        <meshStandardMaterial color="#1e1b4b" />
      </mesh>
      <mesh position={[0, 3.6, 0]}>
        <boxGeometry args={[4.8, 1.1, 0.4]} />
        <meshStandardMaterial color="#0f0a2e" emissive="#e11d48" emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[0, 3.6, 0.21]}>
        <planeGeometry args={[4.4, 0.9]} />
        <meshBasicMaterial map={labelTexture('CASINO', { fg: '#f0abfc', w: 512, h: 128, fontPx: 84 })} transparent />
      </mesh>
    </group>
  )
}

function LittleHouse({ pos }: { pos: [number, number, number] }) {
  return (
    <group position={pos}>
      <mesh position={[0, 1, 0]} castShadow>
        <boxGeometry args={[2.6, 2, 2.6]} />
        <meshStandardMaterial color="#fbbf24" />
      </mesh>
      <mesh position={[0, 2.6, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[2.2, 1.4, 4]} />
        <meshStandardMaterial color="#7f1d1d" />
      </mesh>
    </group>
  )
}

function BeachSpot({ pos }: { pos: [number, number, number] }) {
  return (
    <group position={pos}>
      {/* umbrella */}
      <mesh position={[0, 1.4, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.06, 2.8, 6]} />
        <meshStandardMaterial color="#e2e8f0" />
      </mesh>
      <mesh position={[0, 2.9, 0]} castShadow>
        <coneGeometry args={[1.8, 0.9, 10]} />
        <meshStandardMaterial color="#f472b6" />
      </mesh>
      {/* sand */}
      <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[3.2, 24]} />
        <meshStandardMaterial color="#fde68a" />
      </mesh>
    </group>
  )
}

function GiantDie({ pos }: { pos: [number, number, number] }) {
  const dots: [number, number][] = [
    [-0.6, -0.6],
    [0.6, -0.6],
    [0, 0],
    [-0.6, 0.6],
    [0.6, 0.6],
  ]
  return (
    <group position={pos} rotation={[0, 0.6, 0]}>
      <mesh position={[0, 1.1, 0]} castShadow>
        <boxGeometry args={[2.2, 2.2, 2.2]} />
        <meshStandardMaterial color="#f8fafc" />
      </mesh>
      {dots.map(([x, z], i) => (
        <mesh key={i} position={[x, 2.24, z]}>
          <sphereGeometry args={[0.15, 8, 6]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>
      ))}
    </group>
  )
}

function NeonPylon({ pos }: { pos: [number, number, number] }) {
  const letters = ['S', 'L', 'O', 'T', 'S']
  return (
    <group position={pos}>
      <mesh position={[0, 2.8, 0]} castShadow>
        <boxGeometry args={[1.5, 5.6, 0.5]} />
        <meshStandardMaterial color="#131033" emissive="#7c3aed" emissiveIntensity={0.35} />
      </mesh>
      {letters.map((ch, i) => (
        <mesh key={i} position={[0, 5.05 - i * 1.05, 0.27]}>
          <planeGeometry args={[1.1, 1.0]} />
          <meshBasicMaterial
            map={labelTexture(ch, { fg: '#f0abfc', w: 96, h: 96, fontPx: 78 })}
            transparent
          />
        </mesh>
      ))}
    </group>
  )
}

function BlinkingLights({
  center,
  count = 10,
  radius = 3.2,
  y = 3.5,
}: {
  center: [number, number, number]
  count?: number
  radius?: number
  y?: number
}) {
  const matA = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#f472b6', emissive: '#f472b6', emissiveIntensity: 1 }),
    [],
  )
  const matB = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#fbbf24', emissive: '#fbbf24', emissiveIntensity: 1 }),
    [],
  )
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    matA.emissiveIntensity = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 6))
    matB.emissiveIntensity = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 6 + Math.PI))
  })
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2
        return (
          <mesh
            key={i}
            position={[center[0] + Math.cos(a) * radius, y, center[2] + Math.sin(a) * radius]}
            material={i % 2 ? matA : matB}
          >
            <sphereGeometry args={[0.15, 6, 5]} />
          </mesh>
        )
      })}
    </>
  )
}

function LottoKiosk({ pos }: { pos: [number, number, number] }) {
  return (
    <group position={pos}>
      <mesh position={[0, 1, 0]} castShadow>
        <boxGeometry args={[2.2, 2, 1.7]} />
        <meshStandardMaterial color="#0f766e" />
      </mesh>
      <mesh position={[0, 2.15, 0.6]} rotation={[0.35, 0, 0]} castShadow>
        <boxGeometry args={[2.5, 0.12, 1.2]} />
        <meshStandardMaterial color="#14b8a6" />
      </mesh>
      <mesh position={[0, 2.85, 0]}>
        <boxGeometry args={[2.4, 0.8, 0.3]} />
        <meshStandardMaterial color="#042f2e" emissive="#14b8a6" emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[0, 2.85, 0.16]}>
        <planeGeometry args={[2.2, 0.66]} />
        <meshBasicMaterial map={labelTexture('LOTTO', { fg: '#99f6e4', w: 256, h: 80, fontPx: 60 })} transparent />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------------------
// Background set pieces
// ---------------------------------------------------------------------------

const windowCache = new Map<number, THREE.CanvasTexture>()

function windowsTexture(seed: number): THREE.CanvasTexture {
  const hit = windowCache.get(seed)
  if (hit) return hit
  const rng = mulberry32(seed)
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 128
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#16213c'
  ctx.fillRect(0, 0, 64, 128)
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 4; c++) {
      ctx.fillStyle = rng() < 0.45 ? '#ffd97a' : '#233250'
      ctx.fillRect(6 + c * 14, 6 + r * 12, 9, 7)
    }
  }
  const tex = new THREE.CanvasTexture(canvas)
  windowCache.set(seed, tex)
  return tex
}

function CitySkyline({ pos }: { pos: [number, number, number] }) {
  const buildings = useMemo(() => {
    const rng = mulberry32(31)
    return Array.from({ length: 7 }, (_, i) => ({
      x: i * 4.6 - 14 + rng() * 1.5,
      z: (rng() - 0.5) * 6,
      w: 3 + rng() * 1.6,
      h: 7 + rng() * 9,
      seed: 100 + i,
    }))
  }, [])
  return (
    <group position={pos}>
      {buildings.map((b, i) => {
        const sides = new THREE.MeshStandardMaterial({ map: windowsTexture(b.seed) })
        const flat = new THREE.MeshStandardMaterial({ color: '#101a33' })
        return (
          <mesh
            key={i}
            position={[b.x, b.h / 2, b.z]}
            material={[sides, sides, flat, flat, sides, sides]}
            castShadow
          >
            <boxGeometry args={[b.w, b.h, b.w]} />
          </mesh>
        )
      })}
    </group>
  )
}

function Campus({ pos }: { pos: [number, number, number] }) {
  return (
    <group position={pos} rotation={[0, -0.4, 0]}>
      <mesh position={[0, 1.6, 0]} castShadow>
        <boxGeometry args={[6, 3.2, 4]} />
        <meshStandardMaterial color="#b45309" />
      </mesh>
      {[-2.2, -0.75, 0.75, 2.2].map((x, i) => (
        <mesh key={i} position={[x, 1.6, 2.1]} castShadow>
          <cylinderGeometry args={[0.22, 0.22, 3.2, 8]} />
          <meshStandardMaterial color="#f8fafc" />
        </mesh>
      ))}
      <mesh position={[0, 3.8, 0.4]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[3.6, 1.6, 4]} />
        <meshStandardMaterial color="#7f1d1d" />
      </mesh>
      {/* giant mortarboard on the roof, as is tradition */}
      <mesh position={[0, 4.9, 0.4]} rotation={[0, 0.6, 0.08]}>
        <boxGeometry args={[2.2, 0.16, 2.2]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
    </group>
  )
}

const GONDOLA_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6']

function FerrisWheel({ pos }: { pos: [number, number, number] }) {
  const wheel = useRef<Group>(null)
  useFrame((_, dt) => {
    if (wheel.current) wheel.current.rotation.z += dt * 0.18
  })
  const R = 4.4
  return (
    <group position={pos} rotation={[0, 0.6, 0]}>
      <mesh position={[-1.6, 3.1, 0]} rotation={[0, 0, 0.4]} castShadow>
        <cylinderGeometry args={[0.12, 0.18, 6.8, 6]} />
        <meshStandardMaterial color="#94a3b8" />
      </mesh>
      <mesh position={[1.6, 3.1, 0]} rotation={[0, 0, -0.4]} castShadow>
        <cylinderGeometry args={[0.12, 0.18, 6.8, 6]} />
        <meshStandardMaterial color="#94a3b8" />
      </mesh>
      <group ref={wheel} position={[0, 6.1, 0]}>
        <mesh>
          <torusGeometry args={[R, 0.13, 8, 28]} />
          <meshStandardMaterial color="#e2e8f0" />
        </mesh>
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2
          return (
            <group key={i}>
              <mesh rotation={[0, 0, a]}>
                <boxGeometry args={[0.09, R * 2, 0.09]} />
                <meshStandardMaterial color="#cbd5e1" />
              </mesh>
              <mesh position={[Math.cos(a) * R, Math.sin(a) * R, 0]}>
                <boxGeometry args={[0.8, 0.7, 0.7]} />
                <meshStandardMaterial color={GONDOLA_COLORS[i]} />
              </mesh>
            </group>
          )
        })}
        <mesh>
          <cylinderGeometry args={[0.35, 0.35, 0.5, 10]} />
          <meshStandardMaterial color="#f8fafc" />
        </mesh>
      </group>
    </group>
  )
}

function WindTurbine({ pos, phase }: { pos: [number, number, number]; phase: number }) {
  const blades = useRef<Group>(null)
  useFrame((_, dt) => {
    if (blades.current) blades.current.rotation.z += dt * 1.4
  })
  return (
    <group position={pos} rotation={[0, 0.9, 0]}>
      <mesh position={[0, 4, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.3, 8, 8]} />
        <meshStandardMaterial color="#e2e8f0" />
      </mesh>
      <mesh position={[0, 8, 0.35]}>
        <boxGeometry args={[0.5, 0.5, 1]} />
        <meshStandardMaterial color="#cbd5e1" />
      </mesh>
      <group ref={blades} position={[0, 8, 0.9]} rotation={[0, 0, phase]}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} rotation={[0, 0, (i / 3) * Math.PI * 2]} position={[0, 0, 0]}>
            <boxGeometry args={[0.26, 4.6, 0.06]} />
            <meshStandardMaterial color="#f8fafc" />
          </mesh>
        ))}
      </group>
    </group>
  )
}

function HotAirBalloon({
  base,
  color,
  seed,
}: {
  base: [number, number, number]
  color: string
  seed: number
}) {
  const ref = useRef<Group>(null)
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (ref.current) {
      ref.current.position.set(
        base[0] + Math.sin(t * 0.07 + seed) * 8,
        base[1] + Math.sin(t * 0.4 + seed) * 1.2,
        base[2] + Math.cos(t * 0.05 + seed) * 5,
      )
    }
  })
  return (
    <group ref={ref}>
      <mesh scale={[1, 1.15, 1]}>
        <sphereGeometry args={[2, 12, 10]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, -2.9, 0]}>
        <boxGeometry args={[0.9, 0.7, 0.9]} />
        <meshStandardMaterial color="#92400e" />
      </mesh>
      {[-0.35, 0.35].map((x, i) => (
        <mesh key={i} position={[x, -2.2, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 1.2, 4]} />
          <meshStandardMaterial color="#e2e8f0" />
        </mesh>
      ))}
    </group>
  )
}

function SailBoat({ pos }: { pos: [number, number, number] }) {
  const ref = useRef<Group>(null)
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (ref.current) {
      ref.current.position.y = pos[1] + Math.sin(t * 1.3) * 0.06
      ref.current.rotation.z = Math.sin(t * 0.9) * 0.06
      ref.current.rotation.y = t * 0.1
    }
  })
  return (
    <group ref={ref} position={pos}>
      <mesh position={[0, 0.25, 0]}>
        <boxGeometry args={[1.7, 0.4, 0.75]} />
        <meshStandardMaterial color="#92400e" />
      </mesh>
      <mesh position={[0.1, 1.3, 0]}>
        <cylinderGeometry args={[0.045, 0.045, 1.9, 5]} />
        <meshStandardMaterial color="#e2e8f0" />
      </mesh>
      <mesh position={[0.45, 1.35, 0]} rotation={[0, 0, -0.1]} scale={[1, 1, 0.06]}>
        <coneGeometry args={[0.6, 1.5, 3]} />
        <meshStandardMaterial color="#f8fafc" />
      </mesh>
    </group>
  )
}

function Streetlamps() {
  const lamps = useMemo(() => {
    const out: { pos: [number, number, number]; key: number }[] = []
    for (let i = 4; i < SPACES.length; i += 9) {
      const s = SPACES[i]
      const n = s.next[0]
      if (n === undefined) continue
      if (s.pos[1] > 0.8) continue // no floating lamps beside the skyway
      const b = SPACES[n]
      const dx = b.pos[0] - s.pos[0]
      const dz = b.pos[2] - s.pos[2]
      const len = Math.hypot(dx, dz) || 1
      // left-hand side of the road
      out.push({ key: i, pos: [s.pos[0] - (dz / len) * 2.7, s.pos[1], s.pos[2] + (dx / len) * 2.7] })
    }
    return out
  }, [])
  return (
    <group>
      {lamps.map((l) => (
        <group key={l.key} position={l.pos}>
          <mesh position={[0, 1.5, 0]}>
            <cylinderGeometry args={[0.06, 0.09, 3, 6]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
          <mesh position={[0, 3.1, 0]}>
            <sphereGeometry args={[0.24, 8, 6]} />
            <meshStandardMaterial color="#ffd97a" emissive="#ffd97a" emissiveIntensity={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

const BALLOON_COLORS = ['#f472b6', '#60a5fa', '#fbbf24']

function Balloons({ pos, seed }: { pos: [number, number, number]; seed: number }) {
  const ref = useRef<Group>(null)
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.position.y = pos[1] + Math.sin(clock.getElapsedTime() * 1.1 + seed) * 0.3
    }
  })
  return (
    <group ref={ref} position={pos}>
      {BALLOON_COLORS.map((c, i) => {
        const x = (i - 1) * 0.75
        const y = 3.6 + (i % 2) * 0.7
        return (
          <group key={i} position={[x, 0, (i - 1) * 0.3]}>
            <mesh position={[0, y, 0]}>
              <sphereGeometry args={[0.48, 10, 8]} />
              <meshStandardMaterial color={c} />
            </mesh>
            <mesh position={[0, y / 2 + 0.2, 0]}>
              <cylinderGeometry args={[0.015, 0.015, y - 0.5, 4]} />
              <meshStandardMaterial color="#e2e8f0" />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

function Clouds() {
  const ref = useRef<Group>(null)
  const clouds = useMemo(() => {
    const rng = mulberry32(99)
    return Array.from({ length: 9 }, (_, i) => ({
      x: rng() * 180 - 90,
      y: 18 + rng() * 9,
      z: rng() * 140 - 70,
      s: 1.5 + rng() * 2.4,
      speed: 0.4 + rng() * 0.7,
      key: i,
    }))
  }, [])
  useFrame((_, dt) => {
    if (!ref.current) return
    ref.current.children.forEach((c, i) => {
      c.position.x += clouds[i].speed * dt
      if (c.position.x > 110) c.position.x = -110
    })
  })
  return (
    <group ref={ref}>
      {clouds.map((c) => (
        <group key={c.key} position={[c.x, c.y, c.z]} scale={c.s}>
          <mesh>
            <sphereGeometry args={[1, 8, 6]} />
            <meshStandardMaterial color="#e2e8f0" flatShading />
          </mesh>
          <mesh position={[1.1, -0.1, 0.2]}>
            <sphereGeometry args={[0.7, 8, 6]} />
            <meshStandardMaterial color="#e2e8f0" flatShading />
          </mesh>
          <mesh position={[-1, -0.15, -0.1]}>
            <sphereGeometry args={[0.6, 8, 6]} />
            <meshStandardMaterial color="#e2e8f0" flatShading />
          </mesh>
        </group>
      ))}
    </group>
  )
}

export default function World() {
  const trees = useMemo(() => {
    const rng = mulberry32(7)
    const placed: { pos: [number, number, number]; pine: boolean; s: number }[] = []
    let attempts = 0
    while (placed.length < 60 && attempts < 500) {
      attempts++
      const x = rng() * 170 - 85
      const z = rng() * 130 - 65
      const nearRoad = SPACES.some((sp) => {
        const dx = sp.pos[0] - x
        const dz = sp.pos[2] - z
        return dx * dx + dz * dz < 36
      })
      const dxs = SPINNER_POS[0] - x
      const dzs = SPINNER_POS[2] - z
      if (nearRoad || dxs * dxs + dzs * dzs < 100) continue
      placed.push({ pos: [x, 0, z], pine: rng() < 0.5, s: 0.8 + rng() * 1.1 })
    }
    return placed
  }, [])

  const mountains = useMemo(() => {
    const rng = mulberry32(13)
    return Array.from({ length: 8 }, () => {
      const angle = rng() * Math.PI * 2
      const r = 78 + rng() * 14
      return {
        pos: [Math.cos(angle) * r, 0, Math.sin(angle) * r] as [number, number, number],
        h: 12 + rng() * 16,
        w: 9 + rng() * 8,
      }
    })
  }, [])

  const groundCover = useMemo(() => {
    const rng = mulberry32(11)
    const clear = (x: number, z: number, roadDist = 4.8) => {
      if (SPACES.some((sp) => (sp.pos[0] - x) ** 2 + (sp.pos[2] - z) ** 2 < roadDist * roadDist))
        return false
      if ((SPINNER_POS[0] - x) ** 2 + (SPINNER_POS[2] - z) ** 2 < 100) return false
      if ((-20 - x) ** 2 + (-28 - z) ** 2 < 140) return false // pond
      return true
    }
    const sample = (count: number, range: number) => {
      const out: [number, number][] = []
      let guard = 0
      while (out.length < count && guard++ < count * 30) {
        const x = (rng() - 0.5) * range * 2
        const z = (rng() - 0.5) * (range * 1.5)
        if (clear(x, z)) out.push([x, z])
      }
      return out
    }
    return {
      flowers: sample(26, 70).map(([x, z]) => ({ x, z, hue: rng() })),
      rocks: sample(14, 75).map(([x, z]) => ({ x, z, s: 0.5 + rng() * 0.9, rot: rng() * Math.PI })),
      bushes: sample(24, 72).map(([x, z]) => ({ x, z, s: 0.7 + rng() * 0.8 })),
      patches: sample(10, 60).map(([x, z]) => ({ x, z, r: 3.5 + rng() * 4.5 })),
    }
  }, [])

  const FLOWER_COLORS = ['#f472b6', '#f8fafc', '#fbbf24', '#c4b5fd']

  const marriage = SPACES.find((s) => s.type === 'STOP_MARRIAGE')!
  const houseStop = SPACES.find((s) => s.type === 'STOP_HOUSE')!
  const retirement = SPACES.find((s) => s.type === 'RETIREMENT')!
  const casino = SPACES.find((s) => s.type === 'GAMBLE' && s.branch === 'risky')!
  const lotto = SPACES.find((s) => s.type === 'LOTTERY')!
  const babySpaces = SPACES.filter((s) => s.type === 'BABY')
  const workStop = SPACES.find((s) => s.type === 'STOP_CAREER' && !s.collegePool)!
  const collegeStop = SPACES.find((s) => s.type === 'STOP_CAREER' && s.collegePool)!

  return (
    <group>
      {/* ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <circleGeometry args={[100, 48]} />
        <meshStandardMaterial color="#5a9c4a" />
      </mesh>
      {groundCover.patches.map((p, i) => (
        <mesh key={`patch-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[p.x, 0.012, p.z]}>
          <circleGeometry args={[p.r, 20]} />
          <meshStandardMaterial color="#508b41" />
        </mesh>
      ))}
      {/* pond */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-20, 0.02, -28]}>
        <circleGeometry args={[9, 28]} />
        <meshStandardMaterial color="#38bdf8" />
      </mesh>
      <SailBoat pos={[-22, 0.15, -26]} />

      {trees.map((t, i) => (
        <Tree key={i} {...t} />
      ))}
      {mountains.map((m, i) => (
        <mesh key={i} position={m.pos} castShadow>
          <coneGeometry args={[m.w, m.h, 6]} />
          <meshStandardMaterial color="#64748b" flatShading />
        </mesh>
      ))}

      <Chapel pos={[marriage.pos[0] + 4.5, 0, marriage.pos[2] + 2]} />
      <LittleHouse pos={[houseStop.pos[0] - 4.5, 0, houseStop.pos[2] - 3]} />
      <BeachSpot pos={[retirement.pos[0] - 2.5, retirement.pos[1], retirement.pos[2] - 3.5]} />

      {/* casino district */}
      <Casino pos={[casino.pos[0] + 2, 0, casino.pos[2] - 5]} />
      <BlinkingLights center={[casino.pos[0] + 2, 0, casino.pos[2] - 5]} radius={3.4} y={3.7} />
      <GiantDie pos={[casino.pos[0] + 6.5, 0, casino.pos[2] - 3]} />
      <NeonPylon pos={[casino.pos[0] - 2.5, 0, casino.pos[2] - 6]} />

      <LottoKiosk pos={[lotto.pos[0] - 3.5, lotto.pos[1], lotto.pos[2] - 2]} />
      {babySpaces.map((s, i) => (
        <Balloons key={s.id} pos={[s.pos[0] + 2.3, s.pos[1], s.pos[2] + 2]} seed={i * 2.3} />
      ))}

      {/* background set pieces */}
      <CitySkyline pos={[workStop.pos[0] + 6, 0, workStop.pos[2] + 12]} />
      <Campus pos={[collegeStop.pos[0] - 6, 0, collegeStop.pos[2] - 7]} />
      <FerrisWheel pos={[44, 0, 16]} />
      <WindTurbine pos={[-20, 0, -36]} phase={0} />
      <WindTurbine pos={[6, 0, -38]} phase={1.5} />
      <HotAirBalloon base={[-28, 17, -6]} color="#ef4444" seed={0} />
      <HotAirBalloon base={[30, 20, 30]} color="#38bdf8" seed={3.7} />
      <Streetlamps />

      {/* ground clutter */}
      {groundCover.flowers.map((f, i) => (
        <group key={`fl-${i}`} position={[f.x, 0, f.z]}>
          {[0, 1, 2, 3].map((j) => (
            <mesh key={j} position={[((j % 2) - 0.5) * 0.5, 0.16, (Math.floor(j / 2) - 0.5) * 0.5]}>
              <sphereGeometry args={[0.13, 6, 5]} />
              <meshStandardMaterial color={FLOWER_COLORS[(i + j) % FLOWER_COLORS.length]} />
            </mesh>
          ))}
        </group>
      ))}
      {groundCover.rocks.map((r, i) => (
        <mesh key={`rk-${i}`} position={[r.x, r.s * 0.35, r.z]} rotation={[0, r.rot, 0]} scale={r.s} castShadow>
          <icosahedronGeometry args={[0.6, 0]} />
          <meshStandardMaterial color="#8a97a8" flatShading />
        </mesh>
      ))}
      {groundCover.bushes.map((b, i) => (
        <mesh key={`bs-${i}`} position={[b.x, b.s * 0.4, b.z]} scale={[b.s, b.s * 0.7, b.s]} castShadow>
          <sphereGeometry args={[1, 7, 6]} />
          <meshStandardMaterial color="#3f7a37" flatShading />
        </mesh>
      ))}

      {/* the moon (mandatory for vibes) */}
      <mesh position={[-78, 46, -72]}>
        <sphereGeometry args={[7, 18, 14]} />
        <meshStandardMaterial color="#e2e8f0" emissive="#cbd5e1" emissiveIntensity={0.5} />
      </mesh>

      <Clouds />
    </group>
  )
}
