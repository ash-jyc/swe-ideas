import { useMemo } from 'react'
import { SPACES } from '@midlife/shared'
import type { Space, SpaceType } from '@midlife/shared'
import { labelTexture } from './textTexture'

const TILE_COLOR: Record<SpaceType, string> = {
  START: '#38bdf8',
  EVENT: '#f1f5f9', // cream "plain" spaces — the colored ones are the special ones
  PAYDAY: '#22c55e',
  TAX: '#64748b',
  GAMBLE: '#c026d3',
  LOTTERY: '#14b8a6',
  BABY: '#f472b6',
  CRASH: '#ef4444',
  STOP_CAREER: '#e11d48',
  STOP_MARRIAGE: '#e11d48',
  STOP_HOUSE: '#e11d48',
  RETIREMENT: '#facc15',
}

const TILE_MARK: Partial<Record<SpaceType, string>> = {
  START: 'GO',
  PAYDAY: '$',
  TAX: 'IRS',
  GAMBLE: '777',
  LOTTERY: 'LOTTO',
  BABY: 'BABY',
  CRASH: '!',
}

const isBig = (t: SpaceType) =>
  t === 'START' || t === 'RETIREMENT' || t.startsWith('STOP')

function tileYaw(s: Space): number {
  const next = s.next[0]
  if (next === undefined) return 0
  const [nx, , nz] = SPACES[next].pos
  return Math.atan2(nx - s.pos[0], nz - s.pos[2])
}

function Tile({ s }: { s: Space }) {
  const [x, y, z] = s.pos
  const size = isBig(s.type) ? 3.6 : 2.7
  const yaw = tileYaw(s)
  const mark = TILE_MARK[s.type]

  return (
    <group position={[x, y, z]} rotation={[0, yaw, 0]}>
      {/* support pillar for elevated skyway tiles */}
      {y > 0.8 && (
        <mesh position={[0, -y / 2 + 0.05, 0]} castShadow>
          <cylinderGeometry args={[0.38, 0.5, y + 0.1, 8]} />
          <meshStandardMaterial color="#475569" />
        </mesh>
      )}
      {/* dark base / border */}
      <mesh position={[0, 0.15, 0]} receiveShadow>
        <boxGeometry args={[size + 0.35, 0.3, size + 0.35]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      {/* colored top */}
      <mesh position={[0, 0.36, 0]} receiveShadow>
        <boxGeometry args={[size, 0.18, size]} />
        <meshStandardMaterial color={TILE_COLOR[s.type]} />
      </mesh>
      {mark && (
        <mesh position={[0, 0.46, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[size * 0.8, size * 0.5]} />
          <meshBasicMaterial
            map={labelTexture(mark, { fg: '#0f172a', fontPx: 96 })}
            transparent
          />
        </mesh>
      )}
      {s.label && <SignPost text={s.label} />}
    </group>
  )
}

function SignPost({ text }: { text: string }) {
  return (
    <group position={[0, 0, -2.6]}>
      <mesh position={[0, 1.1, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 2.2, 8]} />
        <meshStandardMaterial color="#8b5a2b" />
      </mesh>
      <mesh position={[0, 2.35, 0]} castShadow>
        <boxGeometry args={[3.4, 0.9, 0.12]} />
        <meshStandardMaterial color="#fef3c7" />
      </mesh>
      <mesh position={[0, 2.35, 0.07]}>
        <planeGeometry args={[3.2, 0.75]} />
        <meshBasicMaterial map={labelTexture(text, { fg: '#7c2d12', w: 512, h: 128, fontPx: 72 })} transparent />
      </mesh>
      <mesh position={[0, 2.35, -0.07]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[3.2, 0.75]} />
        <meshBasicMaterial map={labelTexture(text, { fg: '#7c2d12', w: 512, h: 128, fontPx: 72 })} transparent />
      </mesh>
    </group>
  )
}

/** Flat stepping-stones between consecutive tiles so the path reads as a road. */
function Connectors() {
  const stones = useMemo(() => {
    const out: { pos: [number, number, number]; key: string }[] = []
    for (const s of SPACES) {
      for (const n of s.next) {
        const b = SPACES[n]
        out.push({
          key: `${s.id}-${n}`,
          pos: [
            (s.pos[0] + b.pos[0]) / 2,
            (s.pos[1] + b.pos[1]) / 2 + 0.08,
            (s.pos[2] + b.pos[2]) / 2,
          ],
        })
      }
    }
    return out
  }, [])
  return (
    <group>
      {stones.map((st) => (
        <mesh key={st.key} position={st.pos} receiveShadow>
          <cylinderGeometry args={[0.65, 0.75, 0.16, 10]} />
          <meshStandardMaterial color="#3f4f63" />
        </mesh>
      ))}
    </group>
  )
}

export default function Board() {
  const tiles = useMemo(() => SPACES, [])
  return (
    <group>
      <Connectors />
      {tiles.map((s) => (
        <Tile key={s.id} s={s} />
      ))}
    </group>
  )
}
