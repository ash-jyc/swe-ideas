import { SPACES } from '@midlife/shared'
import { HOP_MS, useStore } from '../state/store'

export interface CarPose {
  x: number
  y: number
  z: number
  yaw: number | null // null = keep current heading
}

/** Where a car should be drawn right now, honoring any hop animation. */
export function carDisplayPose(playerId: string): CarPose {
  const st = useStore.getState()
  const d = st.display[playerId]
  const fallback = st.game?.players.find((p) => p.id === playerId)?.position ?? 0

  if (d?.anim) {
    const { from, path, start } = d.anim
    const elapsed = performance.now() - start
    const hops = path.length
    const t = Math.min(elapsed / HOP_MS, hops)
    const idx = Math.min(Math.floor(t), hops - 1)
    const frac = Math.min(Math.max(t - idx, 0), 1)
    const a = SPACES[idx === 0 ? from : path[idx - 1]].pos
    const b = SPACES[path[idx]].pos
    const hopHeight = 0.7
    return {
      x: a[0] + (b[0] - a[0]) * frac,
      y: a[1] + (b[1] - a[1]) * frac + 4 * hopHeight * frac * (1 - frac),
      z: a[2] + (b[2] - a[2]) * frac,
      yaw: Math.atan2(b[0] - a[0], b[2] - a[2]),
    }
  }

  const spaceId = d?.spaceId ?? fallback
  const [x, y, z] = SPACES[spaceId].pos
  // face toward the next space when resting
  const next = SPACES[spaceId].next[0]
  let yaw: number | null = null
  if (next !== undefined) {
    const [nx, , nz] = SPACES[next].pos
    yaw = Math.atan2(nx - x, nz - z)
  }
  return { x, y, z, yaw }
}
