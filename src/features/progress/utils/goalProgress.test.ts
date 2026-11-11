import { describe, expect, it } from 'vitest'
import {
  addDays,
  buildCalendar,
  computeGoalSummary,
  computeStreaks,
  todayIn,
  type DailyActivity,
} from './goalProgress'

const activity = (...days: string[]): DailyActivity[] => days.map((day) => ({ day, completedCount: 1 }))

describe('addDays', () => {
  it('przechodzi przez granice miesięcy i lat', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
  })
})

describe('todayIn', () => {
  it('liczy dzień w strefie czasowej użytkownika', () => {
    const lateEveningUtc = new Date('2026-03-10T23:30:00Z')
    expect(todayIn('Europe/Warsaw', lateEveningUtc)).toBe('2026-03-11')
    expect(todayIn('UTC', lateEveningUtc)).toBe('2026-03-10')
  })
})

describe('computeGoalSummary', () => {
  const goal = { goalDays: 5, startedOn: '2026-03-01' }

  it('liczy tylko różne dni od rozpoczęcia celu', () => {
    const summary = computeGoalSummary(
      [...activity('2026-02-27', '2026-03-01', '2026-03-03'), { day: '2026-03-03', completedCount: 4 }],
      goal,
      '2026-03-04',
    )
    expect(summary.daysDone).toBe(2)
    expect(summary.fraction).toBeCloseTo(0.4)
    expect(summary.isReached).toBe(false)
    expect(summary.isTodayDone).toBe(false)
  })

  it('ignoruje dni z zerową liczbą rysunków', () => {
    const summary = computeGoalSummary([{ day: '2026-03-02', completedCount: 0 }], goal, '2026-03-04')
    expect(summary.daysDone).toBe(0)
  })

  it('ogranicza postęp do 100% po osiągnięciu celu', () => {
    const summary = computeGoalSummary(
      activity('2026-03-01', '2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06'),
      goal,
      '2026-03-06',
    )
    expect(summary.daysDone).toBe(6)
    expect(summary.fraction).toBe(1)
    expect(summary.isReached).toBe(true)
    expect(summary.isTodayDone).toBe(true)
  })
})

describe('computeStreaks', () => {
  it('utrzymuje serię, jeśli dziś jeszcze nic nie narysowano', () => {
    expect(computeStreaks(activity('2026-03-08', '2026-03-09'), '2026-03-10')).toEqual({ current: 2, longest: 2 })
  })

  it('zeruje bieżącą serię po dniu przerwy', () => {
    expect(
      computeStreaks(activity('2026-03-01', '2026-03-02', '2026-03-03', '2026-03-07'), '2026-03-09'),
    ).toEqual({ current: 0, longest: 3 })
  })

  it('zwraca zera bez aktywności', () => {
    expect(computeStreaks([], '2026-03-09')).toEqual({ current: 0, longest: 0 })
  })
})

describe('buildCalendar', () => {
  it('układa tygodnie od poniedziałku i oznacza dni przyszłe', () => {
    // 2026-03-11 to środa
    const calendar = buildCalendar(activity('2026-03-10'), '2026-03-11', 2)
    expect(calendar).toHaveLength(2)
    expect(calendar[0][0].day).toBe('2026-03-02')
    expect(calendar[1][0].day).toBe('2026-03-09')
    expect(calendar[1][1]).toMatchObject({ day: '2026-03-10', count: 1, isFuture: false })
    expect(calendar[1][2]).toMatchObject({ day: '2026-03-11', isToday: true })
    expect(calendar[1][3].isFuture).toBe(true)
  })
})
