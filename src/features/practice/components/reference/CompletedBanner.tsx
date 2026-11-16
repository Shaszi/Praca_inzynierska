import { Link } from 'react-router-dom'
import { Button } from '../../../../components/ui'

export function CompletedBanner({ onRestart }: { onRestart: () => void }) {
  return (
    <section className="flex flex-col gap-3 rounded-[18px] border border-success/30 bg-success-soft px-4 py-3.5 sm:flex-row sm:items-center">
      <div className="flex-1">
        <p className="font-medium text-success">Wzorzec ukończony</p>
        <p className="text-sm text-ink-soft">Rysunek zapisał się w historii i liczy się do dzisiejszego celu.</p>
      </div>
      <div className="flex gap-2">
        <Link
          to="/app/progress"
          className="flex min-h-11 items-center rounded-full border border-ink-faint bg-surface px-4 text-[15px] font-semibold text-ink transition hover:bg-surface-dim"
        >
          Zobacz postęp
        </Link>
        <Button variant="primary" onClick={onRestart}>
          Narysuj ponownie
        </Button>
      </div>
    </section>
  )
}
