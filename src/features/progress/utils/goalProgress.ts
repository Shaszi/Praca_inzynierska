// Logika celu i kalendarza aktywności. Dni są reprezentowane jako 'YYYY-MM-DD'
// w strefie czasowej użytkownika, dzięki czemu obliczenia nie zależą od strefy przeglądarki.

export type DayKey = string

export type DailyActivity = {
  day: DayKey
  completedCount: number
}

export type Goal = {
  goalDays: number
  startedOn: DayKey
}

export type GoalSummary = {
  goalDays: number
  /** Liczba różnych dni (od rozpoczęcia celu) z co najmniej jednym ukończonym rysunkiem. */
  daysDone: number
  /** 0–1, zaokrąglone w dół do pełnych dni. */
  fraction: number
  isReached: boolean
  isTodayDone: boolean
}

export type Streaks = {
  current: number
  longest: number
}

export type CalendarCell = {
  day: DayKey
  count: number
  isFuture: boolean
  isToday: boolean
}

function toDate(day: DayKey): Date {
  return new Date(`${day}T00:00:00Z`)
}

export function addDays(day: DayKey, amount: number): DayKey {
  const date = toDate(day)
  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0, 10)
}

export function daysBetween(from: DayKey, to: DayKey): number {
  return Math.round((toDate(to).getTime() - toDate(from).getTime()) / 86_400_000)
}

export function todayIn(timeZone: string, now: Date = new Date()): DayKey {
  // Format en-CA daje 'YYYY-MM-DD'.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

function activeDaySet(activity: DailyActivity[]): Set<DayKey> {
  return new Set(activity.filter((entry) => entry.completedCount > 0).map((entry) => entry.day))
}

export function computeGoalSummary(activity: DailyActivity[], goal: Goal, today: DayKey): GoalSummary {
  const activeDays = activeDaySet(activity)
  let daysDone = 0
  for (const day of activeDays) {
    if (day >= goal.startedOn && day <= today) daysDone += 1
  }

  return {
    goalDays: goal.goalDays,
    daysDone,
    fraction: Math.min(daysDone / goal.goalDays, 1),
    isReached: daysDone >= goal.goalDays,
    isTodayDone: activeDays.has(today),
  }
}

export function computeStreaks(activity: DailyActivity[], today: DayKey): Streaks {
  const days = [...activeDaySet(activity)].filter((day) => day <= today).sort()

  let longest = 0
  let run = 0
  let previous: DayKey | null = null
  for (const day of days) {
    run = previous !== null && daysBetween(previous, day) === 1 ? run + 1 : 1
    longest = Math.max(longest, run)
    previous = day
  }

  // Bieżąca seria trwa, jeśli ostatni aktywny dzień to dziś albo wczoraj
  // (dzisiejszy dzień jeszcze się nie skończył).
  const last = days.at(-1)
  const current = last !== undefined && daysBetween(last, today) <= 1 ? run : 0

  return { current, longest }
}

/**
 * Siatka kalendarza w układzie tygodni (poniedziałek–niedziela), kończąca się na tygodniu z `today`.
 * Zwraca tablicę kolumn: każda kolumna to 7 dni jednego tygodnia.
 */
export function buildCalendar(activity: DailyActivity[], today: DayKey, weeks: number): CalendarCell[][] {
  const counts = new Map(activity.map((entry) => [entry.day, entry.completedCount]))
  const weekday = (toDate(today).getUTCDay() + 6) % 7 // 0 = poniedziałek
  const firstDay = addDays(today, -weekday - (weeks - 1) * 7)

  return Array.from({ length: weeks }, (_, week) =>
    Array.from({ length: 7 }, (_, dayOfWeek) => {
      const day = addDays(firstDay, week * 7 + dayOfWeek)
      return {
        day,
        count: counts.get(day) ?? 0,
        isFuture: day > today,
        isToday: day === today,
      }
    }),
  )
}
