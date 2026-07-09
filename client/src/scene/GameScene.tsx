import { Canvas } from '@react-three/fiber'
import { Stars } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '../state/store'
import Board from './Board'
import World from './World'
import Car from './Car'
import Spinner from './Spinner'
import CameraRig from './CameraRig'
import FxLayer from './Fx'

export default function GameScene() {
  const players = useStore((s) => s.game?.players)

  return (
    <div className="scene-wrap">
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ position: [-25, 48, 58], fov: 42 }}
        onCreated={({ scene }) => {
          scene.background = new THREE.Color('#0b1020')
          scene.fog = new THREE.Fog('#0b1020', 130, 230)
        }}
      >
        <ambientLight intensity={0.6} />
        <hemisphereLight args={['#bcd7ff', '#3f6f3f', 0.35]} />
        <directionalLight
          position={[45, 70, 25]}
          intensity={1.5}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-75}
          shadow-camera-right={75}
          shadow-camera-top={75}
          shadow-camera-bottom={-75}
          shadow-camera-far={220}
        />
        <Stars radius={160} depth={40} count={2400} factor={4} saturation={0.4} fade />
        <World />
        <Board />
        <Spinner />
        {players?.map((p) => <Car key={p.id} player={p} seat={p.seat} />)}
        <FxLayer />
        <CameraRig />
      </Canvas>
    </div>
  )
}
