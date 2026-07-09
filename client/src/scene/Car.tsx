import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import type { Group } from 'three'
import type { PlayerState } from '@midlife/shared'
import { COLOR_HEX } from './carColors'
import { carDisplayPose } from './carMath'

const KID_SPOTS: [number, number][] = [
  [-0.42, -0.35],
  [0.42, -0.35],
  [-0.42, -0.95],
  [0.42, -0.95],
]

function Peg({
  x,
  z,
  color,
  scale = 1,
}: {
  x: number
  z: number
  color: string
  scale?: number
}) {
  return (
    <group position={[x, 0.95, z]} scale={scale}>
      <mesh castShadow>
        <capsuleGeometry args={[0.17, 0.28, 3, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  )
}

export default function Car({ player, seat }: { player: PlayerState; seat: number }) {
  const group = useRef<Group>(null)
  const color = COLOR_HEX[player.color]

  // spread cars sharing a tile
  const ox = ((seat % 3) - 1) * 0.95
  const oz = seat < 3 ? -0.55 : 0.55

  useFrame(() => {
    const g = group.current
    if (!g) return
    const pose = carDisplayPose(player.id)
    g.position.set(pose.x + ox, pose.y + 0.45, pose.z + oz)
    if (pose.yaw !== null) {
      // shortest-path yaw damping
      let d = pose.yaw - g.rotation.y
      while (d > Math.PI) d -= Math.PI * 2
      while (d < -Math.PI) d += Math.PI * 2
      g.rotation.y += d * 0.25
    }
  })

  return (
    <group ref={group} scale={player.retired ? 0.85 : 1}>
      {/* body */}
      <mesh position={[0, 0.32, 0]} castShadow>
        <boxGeometry args={[1.5, 0.55, 2.6]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* hood scoop / cabin rim */}
      <mesh position={[0, 0.66, -0.15]} castShadow>
        <boxGeometry args={[1.35, 0.28, 1.7]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* wheels */}
      {(
        [
          [-0.78, 0.75],
          [0.78, 0.75],
          [-0.78, -0.85],
          [0.78, -0.85],
        ] as [number, number][]
      ).map(([wx, wz], i) => (
        <mesh key={i} position={[wx, 0.12, wz]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.32, 0.32, 0.22, 12]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>
      ))}
      {/* driver + spouse pegs (front row) */}
      <Peg x={-0.42} z={0.55} color="#f8fafc" />
      {player.married && <Peg x={0.42} z={0.55} color="#fda4af" />}
      {/* kid pegs (back rows) */}
      {KID_SPOTS.slice(0, player.kids).map(([kx, kz], i) => (
        <Peg key={i} x={kx} z={kz} color="#86efac" scale={0.72} />
      ))}
      {/* zIndexRange keeps tags under the HUD (z 5) and modals (z 15/20/50) */}
      <Html position={[0, 2.1, 0]} center distanceFactor={38} occlude={false} zIndexRange={[4, 0]}>
        <div className="car-tag" style={{ borderColor: color }}>
          {player.name}
          {player.retired ? ' 🌴' : ''}
        </div>
      </Html>
    </group>
  )
}
