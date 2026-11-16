import { plural } from '../../../../utils/plural'
import type { Milestone, WeekDay } from '../../utils/streakRewards'

// Gradient markera. Reguła z projektu: tylko kreska, logo i pasek postępu.
const MARKER = 'linear-gradient(90deg,#ff5fa8 0%,#ff9a3d 55%,#ffd84a 100%)'

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

/** Seria — największa karta, bo to główny powód, żeby dziś narysować kreskę. */
export function StreakCard({
  streak,
  isTodayDone,
  hoursLeft,
  week,
  milestone,
}: {
  streak: number
  isTodayDone: boolean
  hoursLeft: number
  week: WeekDay[]
  milestone: Milestone | null
}) {
  return (
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
  )
}
