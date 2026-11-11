import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Ring } from '../components/Ring'
import { WARMUPS } from '../features/practice/warmups'
import { Spinner } from '../components/ui'
import { useProgress } from '../features/progress/hooks/useProgress'
import { challengeForDay } from '../features/progress/utils/dailyChallenge'
import { badgeStates, hoursLeftToday, nextMilestone, weekStrip } from '../features/progress/utils/streakRewards'
import { plural } from '../utils/plural'

// Gradient markera. Reguła z projektu: tylko kreska, logo i pasek postępu.
const MARKER = 'linear-gradient(90deg,#ff5fa8 0%,#ff9a3d 55%,#ffd84a 100%)'

const ghostButton =
  'inline-flex min-h-10 items-center justify-center self-start rounded-full border-2 border-ink-faint px-4 text-sm font-bold text-ink transition hover:border-ink'

function Flame({ done }: { done: boolean }) {
  return (
    <svg viewBox="0 0 14 16" className={`h-[86px] w-[76px] shrink-0 ${done ? 'text-orange' : 'text-[#7a5a52]'}`} aria-hidden>
      <path d="M7 0C8 4 13 6 13 10.5A6 6 0 0 1 1 10.5C1 8 3 7 4 5c.5 2 1.5 3 2.5 3C6 5 6 2 7 0z" fill="currentColor" />
      {done && (
        <path
          d="M7 8.5c.6 1.6 2.4 2.4 2.4 4.1A2.4 2.4 0 0 1 4.6 12.6c0-1 .7-1.6 1.2-2.3.3.9.8 1.3 1.2 1.3-.3-1-.3-2 0-3.1z"
          fill="#ffd84a"
        />
      )}
    </svg>
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

export function DashboardPage() {
  const { profile, goal, streaks, activity, today, recentSessions, isLoading, error } = useProgress()

  if (isLoading && !profile) {
    return <Spinner className="m-auto h-6 w-6" />
  }

  const streak = streaks.current
  const isTodayDone = goal?.isTodayDone ?? activity.some((e) => e.day === today && e.completedCount > 0)
  const week = weekStrip(activity, today)
  const milestone = nextMilestone(streak)
  const badges = badgeStates(streak)
  const challenge = challengeForDay(today)
  const hoursLeft = hoursLeftToday()
  const lastSession = recentSessions[0] ?? null
  const sessionPercent = lastSession?.stepsTotal
    ? Math.round((lastSession.stepsCompleted / lastSession.stepsTotal) * 100)
    : 0

  return (
    <div className="flex w-full flex-col gap-4 py-2 md:py-4">
      {error && <p className="rounded-[16px] bg-danger-soft px-3.5 py-3 text-sm font-medium text-danger">{error}</p>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Seria — największa karta, bo to główny powód, żeby dziś narysować kreskę. */}
        <section
          className="flex flex-col gap-5 rounded-[24px] border border-line bg-surface p-[22px] lg:col-span-7"
          style={{ backgroundImage: 'radial-gradient(420px 220px at 0% 0%, rgb(255 154 61 / 0.16), transparent 70%)' }}
        >
          <div className="flex items-center gap-[18px]">
            <Flame done={isTodayDone} />
            <div className="min-w-0">
              <p className="flex flex-wrap items-baseline gap-2.5">
                <b className="font-display text-[clamp(48px,6vw,64px)] font-bold leading-none tracking-[-0.03em] text-orange">
                  {streak}
                </b>
                <span className="font-display text-[20px] font-semibold">
                  {plural(streak, 'dzień z rzędu', 'dni z rzędu', 'dni z rzędu')}
                </span>
              </p>
              <p className={`mt-2 text-[15px] ${isTodayDone ? 'text-success' : 'text-warn'}`}>
                {isTodayDone ? (
                  'Dzisiejsza kreska zaliczona. Seria rośnie.'
                ) : (
                  <>
                    Dziś jeszcze bez kreski. Masz{' '}
                    <span className="font-mono">
                      {hoursLeft} {plural(hoursLeft, 'godzinę', 'godziny', 'godzin')}
                    </span>
                    , żeby utrzymać serię.
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {week.map((day) => (
              <div
                key={day.day}
                className={`flex flex-col items-center gap-1.5 text-[12.5px] font-semibold ${
                  day.isToday ? 'text-ink' : 'text-ink-faint'
                }`}
              >
                <span
                  className={[
                    'grid aspect-square w-full max-w-11 place-items-center rounded-full text-base font-extrabold text-on-accent',
                    day.done ? 'bg-orange' : 'bg-surface-dim',
                    day.isToday && !day.done ? 'border-2 border-dashed border-orange bg-transparent' : '',
                  ].join(' ')}
                  aria-hidden
                >
                  {day.done ? '✓' : ''}
                </span>
                <span>{day.label}</span>
              </div>
            ))}
          </div>

          {milestone && (
            <div className="flex flex-col gap-2">
              <span className="text-sm text-ink-soft">
                Do odznaki „{milestone.name}”:{' '}
                <b className="text-ink">
                  jeszcze {milestone.daysLeft} {plural(milestone.daysLeft, 'dzień', 'dni', 'dni')}
                </b>
              </span>
              <div className="h-2.5 overflow-hidden rounded-full border border-line bg-paper-dim">
                <div
                  className="h-full rounded-full transition-[width] duration-700"
                  style={{ width: `${milestone.percent}%`, background: MARKER }}
                />
              </div>
            </div>
          )}
        </section>

        {/* Wyzwanie dnia */}
        <section className="relative flex flex-col gap-3 overflow-hidden rounded-[24px] bg-pink p-[22px] text-on-accent lg:col-span-5">
          <svg
            viewBox="0 0 170 150"
            className="pointer-events-none absolute -top-2.5 -right-6 w-[170px] opacity-90"
            fill="none"
            stroke="#1a1236"
            strokeOpacity=".22"
            strokeWidth="6"
            strokeLinecap="round"
            aria-hidden
          >
            <ellipse cx="96" cy="60" rx="60" ry="30" transform="rotate(-18 96 60)" />
            <ellipse cx="96" cy="60" rx="38" ry="18" transform="rotate(-18 96 60)" />
            <ellipse cx="110" cy="112" rx="44" ry="20" transform="rotate(-10 110 112)" />
          </svg>

          <span className="self-start rounded-full bg-[rgb(26_18_54_/_0.14)] px-3 py-[5px] text-[13px] font-bold">
            Wyzwanie dnia
          </span>
          <h3 className="font-display text-[26px] font-bold leading-[1.1]">{challenge.title}</h3>
          <p className="text-[15px] font-medium">
            {challenge.strokes} kresek, około {challenge.minutes}{' '}
            {plural(challenge.minutes, 'minuty', 'minut', 'minut')}. {challenge.body}
          </p>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-[rgb(255_255_255_/_0.35)] px-3 py-1.5 text-[13px] font-bold">
              Podtrzymuje serię
            </span>
            <span className="rounded-full bg-[rgb(255_255_255_/_0.35)] px-3 py-1.5 text-[13px] font-bold">
              Odznaka dnia
            </span>
          </div>
          <Link
            to="/app/practice"
            className="inline-flex min-h-12 items-center justify-center self-start rounded-full bg-on-accent px-[22px] font-bold text-white transition hover:bg-[#2c2154]"
          >
            Zacznij wyzwanie
          </Link>
        </section>

        {/* Twój cel */}
        <section className="flex flex-col gap-3.5 rounded-[22px] border border-line bg-surface p-[18px] lg:col-span-4">
          <h3 className="text-[15px] font-semibold text-ink-faint">Twój cel</h3>
          {goal ? (
            <div className="flex items-center gap-4">
              <Ring
                percent={Math.round(goal.fraction * 100)}
                label={`Cel: ${goal.daysDone} z ${goal.goalDays} dni`}
              >
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
        </section>

        {/* Kontynuuj */}
        <section className="flex flex-col gap-3.5 rounded-[22px] border border-line bg-surface p-[18px] lg:col-span-4">
          <h3 className="text-[15px] font-semibold text-ink-faint">Kontynuuj</h3>
          {lastSession ? (
            <>
              <div className="min-w-0">
                <b className="block truncate font-display text-[17px]" title={lastSession.title}>
                  {lastSession.title}
                </b>
                <p className="font-mono text-sm text-ink-faint">
                  {lastSession.stepsCompleted} z {lastSession.stepsTotal}{' '}
                  {plural(lastSession.stepsTotal, 'kreska', 'kreski', 'kresek')}
                </p>
              </div>
              <div className="h-2 overflow-hidden rounded-full border border-line bg-paper-dim">
                <div className="h-full rounded-full bg-violet" style={{ width: `${sessionPercent}%` }} />
              </div>
            </>
          ) : (
            <p className="text-sm text-ink-faint">Zacznij pierwsze ćwiczenie, a pojawi się tu skrót do niego.</p>
          )}
          <Link to="/app/practice" className={ghostButton}>
            {lastSession ? 'Wróć do ćwiczenia' : 'Wybierz wzorzec'}
          </Link>
        </section>

        {/* Szybka rozgrzewka */}
        <section className="flex flex-col gap-3.5 rounded-[22px] border border-line bg-surface p-[18px] lg:col-span-4">
          <h3 className="text-[15px] font-semibold text-ink-faint">Szybka rozgrzewka</h3>
          <div className="flex flex-col gap-2">
            {WARMUPS.map((warmup) => (
              <Link
                key={warmup.id}
                to={`/app/practice?wzorzec=${warmup.id}`}
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
        </section>

        {/* Odznaki za serię */}
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
      </div>
    </div>
  )
}
