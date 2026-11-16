import { coverageWords } from '../utils/coverageWords'
import type { LiveProgress } from '../utils/strokeEvaluation'

export function StrokeMeter({ live, finalCoverage }: { live: LiveProgress | null; finalCoverage: number | null }) {
  const coverage = Math.max(0, Math.min(100, finalCoverage ?? live?.coverage ?? 0))
  const rounded = Math.round(coverage)
  const accuracy = live?.accuracy ?? null
  const bar =
    accuracy === null ? 'bg-accent' : accuracy >= 80 ? 'bg-success' : accuracy >= 55 ? 'bg-warn' : 'bg-danger'

  return (
    <div className="flex items-center gap-3">
      <span className="min-w-[96px] text-[13px] text-ink-faint">Narysowane</span>
      <div
        className="h-2.5 flex-1 overflow-hidden rounded-full border border-line bg-paper-dim"
        role="progressbar"
        aria-label="Pokrycie aktualnego kroku"
        aria-valuenow={rounded}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={coverageWords(rounded)}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-100 ease-out ${bar}`}
          style={{ width: `${coverage}%` }}
        />
      </div>
      <span className="min-w-10 text-right text-sm font-bold whitespace-nowrap">{coverageWords(rounded)}</span>
    </div>
  )
}

