import type { DailyActivity, DayKey } from './goalProgress'

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
  got: boolean
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
  percent: number
}

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

export function hoursLeftToday(now = new Date()): number {
  return Math.max(0, 23 - now.getHours())
}
