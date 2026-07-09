import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Vector3 } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { useStore } from '../state/store'
import { carDisplayPose } from './carMath'

const tmp = new Vector3()

export default function CameraRig() {
  const controls = useRef<OrbitControlsImpl>(null)
  const { camera } = useThree()

  useFrame(() => {
    const c = controls.current
    if (!c) return
    const st = useStore.getState()
    const g = st.game

    // follow: an animating car first, else whoever must act
    let focusId: string | null = null
    for (const [pid, d] of Object.entries(st.display)) {
      if (d.anim) {
        focusId = pid
        break
      }
    }
    if (!focusId && g) {
      focusId = g.pending?.playerId ?? g.players[g.turnSeat]?.id ?? null
    }
    if (focusId) {
      const pose = carDisplayPose(focusId)
      tmp.set(pose.x, pose.y + 0.5, pose.z)
      c.target.lerp(tmp, 0.06)
    }

    // crash shake
    const dt = performance.now() - st.shakeAt
    if (st.shakeAt > 0 && dt < 650) {
      const k = (1 - dt / 650) * 0.5
      camera.position.x += (Math.random() - 0.5) * k
      camera.position.y += (Math.random() - 0.5) * k
    }
    c.update()
  })

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      enablePan={false}
      minDistance={10}
      maxDistance={130}
      maxPolarAngle={Math.PI / 2.15}
    />
  )
}
