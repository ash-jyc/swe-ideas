import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
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

  const marriage = SPACES.find((s) => s.type === 'STOP_MARRIAGE')!
  const houseStop = SPACES.find((s) => s.type === 'STOP_HOUSE')!
  const retirement = SPACES.find((s) => s.type === 'RETIREMENT')!
  const casino = SPACES.find((s) => s.type === 'GAMBLE' && s.branch === 'risky')!

  return (
    <group>
      {/* ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <circleGeometry args={[100, 48]} />
        <meshStandardMaterial color="#6aa84f" />
      </mesh>
      {/* pond */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-20, 0.02, -28]}>
        <circleGeometry args={[9, 28]} />
        <meshStandardMaterial color="#38bdf8" />
      </mesh>

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
      <Casino pos={[casino.pos[0] + 2, 0, casino.pos[2] - 5]} />
      <LittleHouse pos={[houseStop.pos[0] - 4.5, 0, houseStop.pos[2] - 3]} />
      <BeachSpot pos={[retirement.pos[0] - 2.5, retirement.pos[1], retirement.pos[2] - 3.5]} />

      <Clouds />
    </group>
  )
}
