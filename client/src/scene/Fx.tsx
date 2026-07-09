import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mulberry32 } from '@midlife/shared'
import { useStore, type FxEvent } from '../state/store'

const COUNT = 110
const dummy = new THREE.Object3D()

function Confetti({ fx }: { fx: FxEvent }) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const start = useMemo(() => performance.now(), [])
  const parts = useMemo(() => {
    const rng = mulberry32(fx.id * 7919 + 13)
    return Array.from({ length: COUNT }, () => ({
      vx: (rng() - 0.5) * 7,
      vy: 4 + rng() * 6,
      vz: (rng() - 0.5) * 7,
      rx: rng() * Math.PI * 2,
      rs: (rng() - 0.5) * 12,
      color: new THREE.Color().setHSL(rng(), 0.85, 0.6),
    }))
  }, [fx.id])

  useFrame(() => {
    const m = mesh.current
    if (!m) return
    const t = (performance.now() - start) / 1000
    const g = 8
    parts.forEach((p, i) => {
      const y = fx.pos[1] + p.vy * t - 0.5 * g * t * t
      dummy.position.set(fx.pos[0] + p.vx * t, Math.max(y, 0.05), fx.pos[2] + p.vz * t)
      dummy.rotation.set(p.rx + p.rs * t, p.rs * t * 0.7, 0)
      const s = Math.max(0, 1 - t / 2.6)
      dummy.scale.setScalar(s)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
      m.setColorAt(i, p.color)
    })
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  })

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, COUNT]} frustumCulled={false}>
      <planeGeometry args={[0.26, 0.26]} />
      <meshBasicMaterial side={THREE.DoubleSide} />
    </instancedMesh>
  )
}

function Smoke({ fx }: { fx: FxEvent }) {
  const group = useRef<THREE.Group>(null)
  const start = useMemo(() => performance.now(), [])
  const puffs = useMemo(() => {
    const rng = mulberry32(fx.id * 104729 + 7)
    return Array.from({ length: 7 }, () => ({
      dx: (rng() - 0.5) * 1.6,
      dz: (rng() - 0.5) * 1.6,
      speed: 0.9 + rng() * 1.4,
    }))
  }, [fx.id])

  useFrame(() => {
    const g = group.current
    if (!g) return
    const t = (performance.now() - start) / 1000
    g.children.forEach((c, i) => {
      const p = puffs[i]
      c.position.set(fx.pos[0] + p.dx * (1 + t), fx.pos[1] + p.speed * t, fx.pos[2] + p.dz * (1 + t))
      c.scale.setScalar(0.35 + t * 1.3)
      const mat = (c as THREE.Mesh).material as THREE.MeshBasicMaterial
      mat.opacity = Math.max(0, 0.65 - t * 0.35)
    })
  })

  return (
    <group ref={group}>
      {puffs.map((_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshBasicMaterial color="#94a3b8" transparent opacity={0.6} />
        </mesh>
      ))}
    </group>
  )
}

export default function FxLayer() {
  const fx = useStore((s) => s.fx)
  return (
    <>
      {fx.map((f) =>
        f.kind === 'confetti' ? <Confetti key={f.id} fx={f} /> : <Smoke key={f.id} fx={f} />,
      )}
    </>
  )
}
