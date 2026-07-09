import { sendAction } from '../net/socket'
import { useStore } from '../state/store'

export default function ChoiceModal() {
  const game = useStore((s) => s.game)
  const session = useStore((s) => s.session)
  const animating = useStore((s) => s.animating)

  const pending = game?.pending
  if (!game || !pending || animating || game.phase !== 'awaitChoice') return null

  const mine = pending.playerId === session?.playerId
  const decider = game.players.find((p) => p.id === pending.playerId)?.name ?? '???'

  return (
    <div className="choice-dock" data-testid="choice-modal">
      <div className="choice-panel">
        <div className="choice-prompt">{pending.prompt}</div>
        {mine ? (
          <div className="choice-options">
            {pending.options.map((o) => (
              <button
                key={o.id}
                className="choice-option"
                onClick={() => sendAction({ type: 'choose', optionId: o.id })}
                data-testid={`choice-${o.id}`}
              >
                <span className="choice-label">{o.label}</span>
                {o.detail && <span className="choice-detail">{o.detail}</span>}
              </button>
            ))}
          </div>
        ) : (
          <div className="choice-waiting">{decider} is deciding… judge silently.</div>
        )}
      </div>
    </div>
  )
}
