import { CheckIcon } from '../../../components/icons'
import { Eyebrow } from '../../../components/ui'
import type { GoalSummary } from '../utils/goalProgress'

// Do tej liczby dni pasek jest dzielony na osobne segmenty — każdy dzień to jedna "kratka".
const MAX_SEGMENTS = 60

function dayWord(count: number): string {
  if (count === 1) return 'dzień'
  return 'dni'
}

export function GoalProgress({ goal, onEdit }: { goal: GoalSummary; onEdit?: () => void }) {
  const percent = Math.round(goal.fraction * 100)
  const remaining = Math.max(goal.goalDays - goal.daysDone, 0)
  const segmented = goal.goalDays <= MAX_SEGMENTS

  return (
    <div className="rounded-[22px] border border-line bg-surface p-[18px] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Eyebrow>Twój cel</Eyebrow>
          <p className="mt-3 flex items-baseline gap-2">
            <span className="font-mono text-[44px] font-medium leading-none tracking-[-0.03em] text-ink">
              {goal.daysDone}
              <span className="text-ink-faint">/{goal.goalDays}</span>
            </span>
            <span className="text-[17px] font-semibold text-ink-soft">{dayWord(goal.goalDays)}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={[
              'inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold',
              goal.isTodayDone ? 'bg-success-soft text-success' : 'bg-warn-soft text-warn',
            ].join(' ')}
          >
            {goal.isTodayDone && <CheckIcon className="h-4 w-4" />}
            {goal.isTodayDone ? 'Dziś zaliczone' : 'Dziś jeszcze bez rysunku'}
          </span>
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="min-h-9 rounded-full border border-ink-faint bg-surface px-3 text-sm font-semibold text-ink transition hover:bg-surface-dim"
            >
              Zmień cel
            </button>
          )}
        </div>
      </div>

      <div
        className="mt-5"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={goal.goalDays}
        aria-valuenow={goal.daysDone}
        aria-label="Postęp celu"
      >
        {segmented ? (
          <div className="flex h-2.5 gap-[3px]">
            {Array.from({ length: goal.goalDays }, (_, index) => (
              <span
                key={index}
                className={[
                  'h-full flex-1 rounded-[3px] transition-colors duration-500',
                  index < goal.daysDone ? 'bg-accent' : 'bg-paper-dim',
                ].join(' ')}
                style={{ transitionDelay: `${index * 15}ms` }}
              />
            ))}
          </div>
        ) : (
          <div className="h-2.5 overflow-hidden rounded-full border border-line bg-paper-dim">
            <div
              // Gradient markera — jedno z trzech miejsc, gdzie projekt go dopuszcza.
              className="h-full rounded-full bg-[linear-gradient(90deg,#ff5fa8_0%,#ff9a3d_55%,#ffd84a_100%)] transition-[width] duration-700"
              style={{ width: `${percent}%` }}
            />
          </div>
        )}
      </div>

      <p className="mt-3 text-sm text-ink-faint">
        {goal.isReached ? (
          'Cel osiągnięty. Możesz ustawić kolejny.'
        ) : (
          <>
            <span className="font-mono text-ink">{percent}%</span> · zostało {remaining} {dayWord(remaining)} z co
            najmniej jednym ukończonym rysunkiem.
          </>
        )}
      </p>
    </div>
  )
}
