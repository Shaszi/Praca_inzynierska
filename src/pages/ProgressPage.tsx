import { useState } from 'react'
import { ActivityCalendar } from '../features/progress/components/ActivityCalendar'
import { GoalProgress } from '../features/progress/components/GoalProgress'
import { GoalSetup } from '../features/progress/components/GoalSetup'
import { SessionGrid } from '../features/progress/components/SessionGrid'
import { useProgress } from '../features/progress/hooks/useProgress'

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-5 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-faint">{label}</p>
      <p className="mt-2 font-mono text-[36px] font-medium leading-none tracking-[-0.03em] text-ink">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-faint">{hint}</p>}
    </div>
  )
}

export function ProgressPage() {
  const { profile, activity, today, goal, streaks, totalCompleted, recentSessions, isLoading, error, setGoal } =
    useProgress()
  const [isEditingGoal, setIsEditingGoal] = useState(false)

  if (isLoading && !profile) {
    return <div className="m-auto h-6 w-6 animate-spin rounded-full border-2 border-line border-t-ink" />
  }

  const activeDays = activity.filter((entry) => entry.completedCount > 0).length
  const showSetup = !goal || isEditingGoal

  return (
    <div className="flex w-full flex-col gap-8 py-2 md:py-4">
      <header>
        <h1 className="text-[26px] font-bold tracking-[-0.01em] text-ink sm:text-[30px]">Postęp</h1>
        <p className="mt-2 text-ink-soft">Ukończone rysunki i dni ćwiczeń zapisują się na Twoim koncie.</p>
      </header>

      {error && <p className="rounded-xl bg-danger-soft px-3.5 py-3 text-sm font-medium text-danger">{error}</p>}

      {showSetup ? (
        <GoalSetup
          initialDays={profile?.goalDays ?? 30}
          onSave={async (days) => {
            await setGoal(days)
            setIsEditingGoal(false)
          }}
          onCancel={goal ? () => setIsEditingGoal(false) : undefined}
          onClear={
            goal
              ? async () => {
                  await setGoal(null)
                  setIsEditingGoal(false)
                }
              : undefined
          }
        />
      ) : (
        <GoalProgress goal={goal} onEdit={() => setIsEditingGoal(true)} />
      )}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Bieżąca seria" value={streaks.current} hint="dni z rzędu" />
        <Stat label="Najdłuższa seria" value={streaks.longest} hint="dni z rzędu" />
        <Stat label="Aktywne dni" value={activeDays} hint="w ostatnim roku" />
        <Stat label="Ukończone rysunki" value={totalCompleted} hint="w ostatnim roku" />
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.08em] text-ink-faint">Aktywność</h2>
        <ActivityCalendar activity={activity} today={today} weeks={53} />
      </section>

      <section>
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.08em] text-ink-faint">Historia rysunków</h2>
        {recentSessions.length > 0 ? (
          <SessionGrid sessions={recentSessions} />
        ) : (
          <p className="rounded-2xl border border-dashed border-line-strong px-5 py-10 text-center text-sm text-ink-soft">
            Ukończ pierwsze ćwiczenie, a pojawi się tutaj.
          </p>
        )}
      </section>
    </div>
  )
}
