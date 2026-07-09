import { cardById } from '@midlife/shared'
import type { CardCategory, CardEffect } from '@midlife/shared'
import { useStore } from '../state/store'

const CATEGORY_META: Record<CardCategory, { emoji: string; label: string; color: string }> = {
  relationships: { emoji: '💘', label: 'Relationships', color: '#f472b6' },
  vices: { emoji: '🍸', label: 'Vices', color: '#c084fc' },
  money: { emoji: '💸', label: 'Money', color: '#4ade80' },
  internet: { emoji: '📱', label: 'The Internet', color: '#60a5fa' },
  news: { emoji: '🗞️', label: 'Current Events', color: '#94a3b8' },
  career: { emoji: '💼', label: 'Career', color: '#fbbf24' },
  health: { emoji: '🫀', label: 'Health-ish', color: '#2dd4bf' },
}

const k = (n: number) => `${n < 0 ? '-' : '+'}$${Math.abs(n).toLocaleString()}`

export function describeEffect(e: CardEffect | undefined): string[] {
  if (!e) return []
  const out: string[] = []
  if (e.cash) out.push(k(e.cash))
  if (e.cashPerKid) out.push(`${k(e.cashPerKid)} per kid`)
  if (e.salaryPct) out.push(`Salary ${e.salaryPct > 0 ? '+' : ''}${e.salaryPct}%`)
  if (e.debt) out.push(e.debt > 0 ? `+$${(e.debt / 1000).toFixed(0)}k debt` : `-$${(-e.debt / 1000).toFixed(0)}k debt`)
  if (e.move) out.push(e.move > 0 ? `Move ahead ${e.move}` : `Move back ${-e.move}`)
  if (e.skipTurn) out.push('Lose a turn')
  if (e.marry) out.push('Get married 💍')
  if (e.divorce) out.push(`Divorce: lose ${e.divorcePct ?? 50}% of your cash 💔`)
  if (e.kids) out.push(`+${e.kids} kid${e.kids > 1 ? 's' : ''} 👶`)
  if (e.insurance) out.push('Gain car insurance 🛡️')
  if (e.newCareer) out.push('Forced career change 💼')
  if (e.gamble) out.push(`Coin flip: win $${(e.gamble.win / 1000).toFixed(0)}k or lose $${(e.gamble.lose / 1000).toFixed(0)}k`)
  if (out.length === 0) out.push('Nothing happens. Somehow that’s worse.')
  return out
}

export default function EventCardModal() {
  const cardId = useStore((s) => s.activeCardId)
  const dismiss = useStore((s) => s.dismissCard)
  if (!cardId) return null
  const card = cardById(cardId)
  const meta = CATEGORY_META[card.category]

  return (
    <div className="card-overlay" onClick={dismiss} data-testid="event-card">
      <div
        className="event-card"
        style={{ borderColor: meta.color, boxShadow: `0 0 70px ${meta.color}44, 0 40px 90px rgba(0,0,0,0.7)` }}
      >
        <div className="event-card-watermark" aria-hidden>
          {meta.emoji}
        </div>
        <div className="event-card-cat" style={{ color: meta.color }}>
          {meta.emoji} {meta.label.toUpperCase()}
        </div>
        <h2 className="event-card-title">{card.title}</h2>
        <p className="event-card-flavor">{card.flavor}</p>
        <div className="event-card-effects">
          {card.choice ? (
            <span className="event-card-effect">A choice is coming…</span>
          ) : (
            describeEffect(card.effect).map((line, i) => (
              <span
                key={i}
                className={`event-card-effect${line.startsWith('-') ? ' bad' : line.startsWith('+') ? ' good' : ''}`}
              >
                {line}
              </span>
            ))
          )}
        </div>
        <div className="event-card-hint">click to continue</div>
      </div>
    </div>
  )
}
