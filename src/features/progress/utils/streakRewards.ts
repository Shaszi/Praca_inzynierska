import type { DailyActivity, DayKey } from './goalProgress'

/** Progi odznak i ich nazwy — dokładnie jak w projekcie. */
export const BADGES: { days: number; name: string }[] = [
  { days: 3, name: 'Pierwsza iskra' },
  { days: 7, name: 'Tydzień w ogniu' },
  { days: 14, name: 'Pewna ręka' },
  { days: 30, name: 'Miesiąc kresek' },
  { days: 100, name: 'Mistrz linii' },
]

export type BadgeState = {
  days: number
  name: string
  /** Zdobyta: seria sięgnęła progu. */
  got: boolean
  /** Najbliższa niezdobyta — w projekcie ma różową obwódkę i licznik. */
  next: boolean
}

export function badgeStates(streak: number): BadgeState[] {
  const nextIndex = BADGES.findIndex((badge) => streak < badge.days)
  return BADGES.map((badge, index) => ({
    ...badge,
    got: streak >= badge.days,
    next: index === nextIndex,
  }))
}

export type Milestone = {
  name: string
  daysLeft: number
  /** 0–100, postęp od poprzedniego progu do następnego. */
  percent: number
}

/** Postęp do najbliższej odznaki. Null, gdy wszystkie są zdobyte. */
export function nextMilestone(streak: number): Milestone | null {
  const index = BADGES.findIndex((badge) => streak < badge.days)
  if (index === -1) return null

  const target = BADGES[index]
  const previous = index === 0 ? 0 : BADGES[index - 1].days
  const span = target.days - previous

  return {
    name: target.name,
    daysLeft: target.days - streak,
    percent: span <= 0 ? 100 : Math.round(((streak - previous) / span) * 100),
  }
}

export type WeekDay = {
  day: DayKey
  /** Pn, Wt, … */
  label: string
  done: boolean
  isToday: boolean
}

const WEEKDAY_LABELS = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So']

function shiftDay(day: DayKey, delta: number): DayKey {
  const [year, month, date] = day.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, month - 1, date + delta))
  return shifted.toISOString().slice(0, 10)
}

/** Siedem dni kończących się dzisiejszym — pasek tygodnia z karty serii. */
export function weekStrip(activity: DailyActivity[], today: DayKey): WeekDay[] {
  const counts = new Map(activity.map((entry) => [entry.day, entry.completedCount]))

  return Array.from({ length: 7 }, (_, index) => {
    const day = shiftDay(today, index - 6)
    const [year, month, date] = day.split('-').map(Number)
    return {
      day,
      label: WEEKDAY_LABELS[new Date(Date.UTC(year, month - 1, date)).getUTCDay()],
      done: (counts.get(day) ?? 0) > 0,
      isToday: day === today,
    }
  })
}

/** Ile pełnych godzin zostało do północy — licznik „utrzymaj serię". */
export function hoursLeftToday(now = new Date()): number {
  return Math.max(0, 23 - now.getHours())
}
