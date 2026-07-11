import { useStore } from './state/store'
import Home from './ui/Home'
import Lobby from './ui/Lobby'
import HUD from './ui/HUD'
import EventCardModal from './ui/EventCardModal'
import ChoiceModal from './ui/ChoiceModal'
import SpinOverlay from './ui/SpinOverlay'
import GameOverModal from './ui/GameOverModal'
import Toasts from './ui/Toasts'
import GameScene from './scene/GameScene'

export default function App() {
  const room = useStore((s) => s.room)
  const game = useStore((s) => s.game)
  const animating = useStore((s) => s.animating)

  let screen: React.ReactNode
  if (!room) {
    screen = <Home />
  } else if (room.phase === 'lobby' || !game) {
    screen = <Lobby />
  } else {
    screen = (
      <div className="game-root">
        <GameScene />
        <HUD />
        <SpinOverlay />
        <EventCardModal />
        <ChoiceModal />
        {game.phase === 'gameOver' && !animating && <GameOverModal />}
      </div>
    )
  }

  return (
    <>
      {screen}
      <Toasts />
    </>
  )
}
