import { Link } from 'react-router-dom'
import { ArrowRightIcon, FlameIcon, ImageIcon, PencilIcon } from '../components/icons'
import { GoalProgress } from '../features/progress/components/GoalProgress'
import { GoalSetup } from '../features/progress/components/GoalSetup'
import { SessionGrid } from '../features/progress/components/SessionGrid'
import { useProgress } from '../features/progress/hooks/useProgress'

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 5 || hour >= 19) return 'Dobry wieczór'
  if (hour < 12) return 'Dzień dobry'
  return 'Cześć'
}

export function DashboardPage() {
  const { profile, goal, streaks, recentSessions, isLoading, error, setGoal } = useProgress()

  if (isLoading && !profile) {
    return <div className="m-auto h-6 w-6 animate-spin rounded-full border-2 border-line border-t-ink" />
  }

  return (
    <div className="flex w-full flex-col gap-8 py-2 md:py-4">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold tracking-[-0.01em] text-ink sm:text-[30px]">
            {greeting()}
            {profile?.displayName ? `, ${profile.displayName}` : ''}.
          </h1>
          <p className="mt-2 text-ink-soft">Jeden ukończony rysunek dziennie wystarczy, żeby ręka nie wyszła z wprawy.</p>
        </div>
        {streaks.current > 0 && (
          <p className="inline-flex items-center gap-2 min-h-9 rounded-full border border-line bg-surface px-3.5 text-sm font-semibold text-ink">
            <FlameIcon className="h-4 w-4 text-warn" />
            Seria: <span className="font-mono">{streaks.current}</span>
          </p>
        )}
      </header>

      {error && <p className="rounded-xl bg-danger-soft px-3.5 py-3 text-sm font-medium text-danger">{error}</p>}

      {goal ? (
        <Link to="/app/progress" className="block transition hover:opacity-95">
          <GoalProgress goal={goal} />
        </Link>
      ) : (
        profile && <GoalSetup onSave={(days) => setGoal(days)} />
      )}

      <section className="grid gap-4 sm:grid-cols-2">
        <Link
          to="/app/practice"
          className="group flex flex-col rounded-2xl border border-line bg-surface p-[18px] transition hover:border-accent-line hover:bg-accent-soft"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent"><PencilIcon className="h-5 w-5" /></span>
          <h2 className="mt-4 text-[17px] font-bold text-ink">Ćwiczenie z wzorcem</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Odrysowuj zapisane wzorce kreska po kresce. Każda kreska dostaje ocenę dopasowania i komentarz AI.
          </p>
          <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-accent">
            Zacznij <ArrowRightIcon className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </span>
        </Link>
        <Link
          to="/app/practice/image"
          className="group flex flex-col rounded-2xl border border-line bg-surface p-[18px] transition hover:border-accent-line hover:bg-accent-soft"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent"><ImageIcon className="h-5 w-5" /></span>
          <h2 className="mt-4 text-[17px] font-bold text-ink">Rysunek ze zdjęcia</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Wgraj zdjęcie, a AI rozpisze je na kroki — od głównych brył do detali — i oceni każdy etap.
          </p>
          <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-accent">
            Wgraj zdjęcie <ArrowRightIcon className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </span>
        </Link>
      </section>

      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-faint">Ostatnie rysunki</h2>
          {recentSessions.length > 0 && (
            <Link to="/app/progress" className="text-sm font-semibold text-accent hover:text-accent-strong">
              Cała historia
            </Link>
          )}
        </div>
        {recentSessions.length > 0 ? (
          <SessionGrid sessions={recentSessions.slice(0, 4)} />
        ) : (
          <p className="rounded-2xl border border-dashed border-line-strong px-5 py-10 text-center text-sm text-ink-soft">
            Tu pojawią się Twoje ukończone rysunki.
          </p>
        )}
      </section>
    </div>
  )
}
