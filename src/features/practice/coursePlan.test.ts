import { describe, expect, it } from 'vitest'
import { pathLength } from './contours'
import { classifyContours, planCourse } from './coursePlan'

const line = (x0: number, y0: number, x1: number, y1: number, n = 40) =>
  Array.from({ length: n }, (_, i) => ({ x: x0 + ((x1 - x0) * i) / (n - 1), y: y0 + ((y1 - y0) * i) / (n - 1) }))

function squareMask() {
  const data = new Uint8Array(100 * 100)
  for (let y = 20; y < 80; y++) for (let x = 20; x < 80; x++) data[y * 100 + x] = 1
  return { data, width: 100, height: 100 }
}

describe('classifyContours', () => {
  it('linia na granicy maski to obrys, długa w środku to konstrukcja, krótka to detal', () => {
    const roles = classifyContours(
      [line(20, 20, 79, 20), line(30, 50, 70, 50), line(45, 40, 50, 40, 6)],
      100,
      100,
      squareMask(),
    )
    expect(roles).toEqual(['outline', 'structure', 'detail'])
  })

  it('bez maski nie ma obrysu — liczy się długość', () => {
    expect(classifyContours([line(20, 20, 79, 20)], 100, 100, null)).toEqual(['structure'])
  })
})

describe('planCourse', () => {
  it('układa obrys przed konstrukcją, a konstrukcję przed detalem', () => {
    const plan = planCourse(
      [line(45, 40, 52, 40, 8), line(30, 50, 70, 50), line(20, 20, 79, 20), line(79, 20, 79, 79)],
      100,
      100,
      squareMask(),
    )
    expect(plan.map((step) => step.role)).toEqual(['outline', 'outline', 'structure', 'detail'])
  })

  it('kolejna linia zaczyna się tam, gdzie skończyła się poprzednia', () => {
    const plan = planCourse(
      [line(79, 79, 20, 79), line(20, 20, 79, 20), line(79, 79, 79, 20)],
      100,
      100,
      squareMask(),
    )
    for (let i = 1; i < plan.length; i++) {
      const end = plan[i - 1].points[plan[i - 1].points.length - 1]
      const start = plan[i].points[0]
      expect(Math.hypot(end.x - start.x, end.y - start.y)).toBeLessThan(1)
    }
    expect(plan[0].points[0].y).toBe(20)
  })

  it('odrzuca najkrótsze linie wewnątrz — fakturę i cienie', () => {
    const plan = planCourse([line(20, 20, 79, 20), line(50, 50, 51, 50, 2)], 100, 100, squareMask())
    expect(plan).toHaveLength(1)
    expect(pathLength(plan[0].points)).toBeGreaterThan(50)
  })
})
