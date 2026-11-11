import { describe, expect, it } from 'vitest'
import { badgeStates, hoursLeftToday, nextMilestone, weekStrip } from './streakRewards'
import { challengeForDay } from './dailyChallenge'

describe('badgeStates', () => {
  it('bez serii nic nie jest zdobyte, a pierwsza odznaka jest następna', () => {
    const states = badgeStates(0)
    expect(states.map((s) => s.got)).toEqual([false, false, false, false, false])
    expect(states.filter((s) => s.next).map((s) => s.days)).toEqual([3])
  })

  it('próg zalicza się dokładnie na swojej wartości', () => {
    expect(badgeStates(3)[0].got).toBe(true)
    expect(badgeStates(2)[0].got).toBe(false)
  })

  it('następna jest zawsze dokładnie jedna', () => {
    for (const streak of [0, 1, 3, 7, 13, 30, 99]) {
      expect(badgeStates(streak).filter((s) => s.next)).toHaveLength(1)
    }
  })

  it('po ostatnim progu nie ma już następnej', () => {
    expect(badgeStates(100).every((s) => s.got)).toBe(true)
    expect(badgeStates(100).some((s) => s.next)).toBe(false)
  })
})

describe('nextMilestone', () => {
  it('liczy postęp od poprzedniego progu, nie od zera', () => {
    // Między 3 i 7 dniami rozpiętość to 4 dni; 5 dni = 2 z 4 = 50%.
    const milestone = nextMilestone(5)!
    expect(milestone.name).toBe('Tydzień w ogniu')
    expect(milestone.daysLeft).toBe(2)
    expect(milestone.percent).toBe(50)
  })

  it('na starcie celuje w pierwszą odznakę', () => {
    expect(nextMilestone(0)!.name).toBe('Pierwsza iskra')
    expect(nextMilestone(0)!.percent).toBe(0)
  })

  it('null, gdy wszystkie odznaki są zdobyte', () => {
    expect(nextMilestone(100)).toBeNull()
    expect(nextMilestone(250)).toBeNull()
  })
})

describe('weekStrip', () => {
  const today = '2026-11-04'

  it('zwraca siedem dni kończących się dzisiejszym', () => {
    const week = weekStrip([], today)
    expect(week).toHaveLength(7)
    expect(week[6].day).toBe(today)
    expect(week[6].isToday).toBe(true)
    expect(week[0].day).toBe('2026-10-29')
  })

  it('zalicza dzień, gdy ma choć jeden ukończony rysunek', () => {
    const week = weekStrip(
      [
        { day: '2026-11-04', completedCount: 2 },
        { day: '2026-11-03', completedCount: 0 },
      ],
      today,
    )
    expect(week[6].done).toBe(true)
    expect(week[5].done).toBe(false)
  })

  it('poprawnie przechodzi przez granicę miesiąca', () => {
    const week = weekStrip([], '2026-03-02')
    expect(week[0].day).toBe('2026-02-24')
    expect(week.map((d) => d.label)).toEqual(['Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd', 'Pn'])
  })
})

describe('hoursLeftToday', () => {
  it('liczy pełne godziny do północy', () => {
    expect(hoursLeftToday(new Date(2026, 10, 4, 16, 30))).toBe(7)
    expect(hoursLeftToday(new Date(2026, 10, 4, 23, 59))).toBe(0)
    expect(hoursLeftToday(new Date(2026, 10, 4, 0, 1))).toBe(23)
  })
})

describe('challengeForDay', () => {
  it('ten sam dzień daje to samo wyzwanie', () => {
    expect(challengeForDay('2026-11-04')).toEqual(challengeForDay('2026-11-04'))
  })

  it('różne dni dają różne wyzwania w obrębie listy', () => {
    const titles = new Set(
      ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'].map(
        (day) => challengeForDay(day).title,
      ),
    )
    expect(titles.size).toBeGreaterThan(1)
  })
})
