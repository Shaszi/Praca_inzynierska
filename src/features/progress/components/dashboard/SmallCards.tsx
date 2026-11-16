import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Ring } from '../../../../components/Ring'
import { plural } from '../../../../utils/plural'
import { WARMUPS } from '../../../practice/warmups'
import type { PracticeSessionSummary } from '../../services/progressService'
import type { GoalSummary } from '../../utils/goalProgress'
import type { BadgeState } from '../../utils/streakRewards'

const ghostButton =
  'inline-flex min-h-10 items-center justify-center self-start rounded-full border-2 border-ink-faint px-4 text-sm font-bold text-ink transition hover:border-ink'

/** Wspólna oprawa małych kart pulpitu: tytuł i treść. */
function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3.5 rounded-[22px] border border-line bg-surface p-[18px] lg:col-span-4">
      <h3 className="text-[15px] font-semibold text-ink-faint">{title}</h3>
      {children}
    </section>
  )
}

export function GoalCard({ goal }: { goal: GoalSummary | null }) {
  return (
    <Card title="Twój cel">
      {goal ? (
        <div className="flex items-center gap-4">
          <Ring percent={Math.round(goal.fraction * 100)} label={`Cel: ${goal.daysDone} z ${goal.goalDays} dni`}>
            <span className="font-mono">{goal.daysDone}</span>
          </Ring>
          <div className="min-w-0">
            <b className="font-mono text-[17px]">
              {goal.daysDone} z {goal.goalDays} dni
            </b>
            <p className="text-sm text-ink-faint">
              {goal.isReached
                ? 'Cel osiągnięty. Możesz ustawić kolejny.'
                : `Jeszcze ${goal.goalDays - goal.daysDone} ${plural(goal.goalDays - goal.daysDone, 'dzień', 'dni', 'dni')} do celu.`}
            </p>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm text-ink-faint">Nie masz jeszcze celu. Ustaw, ile dni chcesz ćwiczyć.</p>
          <Link to="/app/progress" className={ghostButton}>
            Ustaw cel
          </Link>
        </>
      )}
    </Card>
  )
}

export function ContinueCard({ session }: { session: PracticeSessionSummary | null }) {
  const percent = session?.stepsTotal ? Math.round((session.stepsCompleted / session.stepsTotal) * 100) : 0
  return (
    <Card title="Kontynuuj">
      {session ? (
        <>
          <div className="min-w-0">
            <b className="block truncate font-display text-[17px]" title={session.title}>
              {session.title}
            </b>
            <p className="font-mono text-sm text-ink-faint">
              {session.stepsCompleted} z {session.stepsTotal} {plural(session.stepsTotal, 'kreska', 'kreski', 'kresek')}
            </p>
          </div>
          <div className="h-2 overflow-hidden rounded-full border border-line bg-paper-dim">
            <div className="h-full rounded-full bg-violet" style={{ width: `${percent}%` }} />
          </div>
        </>
      ) : (
        <p className="text-sm text-ink-faint">Zacznij pierwsze ćwiczenie, a pojawi się tu skrót do niego.</p>
      )}
      <Link to="/app/practice" className={ghostButton}>
        {session ? 'Wróć do ćwiczenia' : 'Wybierz wzorzec'}
      </Link>
    </Card>
  )
}

// Ilustracje do wbudowanych rozgrzewek. Same ćwiczenia (nazwa, czas, kreski) żyją
// w features/practice/warmups.ts — pulpit tylko do nich linkuje.
const WARMUP_ART: Record<string, ReactNode> = {
  'warmup-lines': (
    <svg viewBox="0 0 40 40" fill="none" stroke="#4fd2ff" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
      <path d="M10 14h20M10 20h20M10 26h20" />
    </svg>
  ),
  'warmup-ellipses': (
    <svg viewBox="0 0 40 40" fill="none" stroke="#ffd84a" strokeWidth="2.4" aria-hidden>
      <ellipse cx="20" cy="20" rx="12" ry="7" />
    </svg>
  ),
}

export function WarmupCard() {
  return (
    <Card title="Szybka rozgrzewka">
      <div className="flex flex-col gap-2">
        {WARMUPS.map((warmup) => (
          <Link
            key={warmup.id}
            to={`/app/practice?ref=${warmup.id}`}
            className="flex items-center gap-3 rounded-[14px] bg-paper-dim p-2 transition hover:bg-surface-dim"
          >
            <span className="h-10 w-10 shrink-0 rounded-[10px] bg-surface-dim p-1.5">{WARMUP_ART[warmup.id]}</span>
            <span className="min-w-0">
              <b className="block text-[14.5px]">{warmup.name}</b>
              <small className="text-[12.5px] text-ink-faint">
                {warmup.minutes} {plural(warmup.minutes, 'minuta', 'minuty', 'minut')} ·{' '}
                {warmup.strokes.length} {plural(warmup.strokes.length, 'kreska', 'kreski', 'kresek')}
              </small>
            </span>
          </Link>
        ))}
      </div>
    </Card>
  )
}

export function BadgesCard({ badges }: { badges: BadgeState[] }) {
  return (
    <section className="flex flex-col gap-[18px] rounded-[24px] border border-line bg-surface px-[22px] py-5 lg:col-span-12">
      <h3 className="text-[15px] font-semibold text-ink-faint">Odznaki za serię</h3>
      <div className="relative grid grid-cols-5">
        <span className="absolute top-[27px] right-[10%] left-[10%] h-1 rounded bg-surface-dim" aria-hidden />
        {badges.map((badge) => (
          <div key={badge.days} className="relative flex flex-col items-center gap-2 text-center">
            <i
              className={[
                'grid h-[58px] w-[58px] place-items-center rounded-full border-[3px] border-paper-dim text-base font-extrabold not-italic',
                badge.got
                  ? 'bg-accent text-on-accent'
                  : badge.next
                    ? 'border-pink bg-surface text-pink'
                    : 'bg-surface-dim text-ink-faint',
              ].join(' ')}
              aria-hidden
            >
              {badge.got ? '✓' : badge.days}
            </i>
            <b className="text-sm">{badge.days} dni</b>
            <small className="text-[12.5px] text-ink-faint">{badge.name}</small>
          </div>
        ))}
      </div>
    </section>
  )
}
