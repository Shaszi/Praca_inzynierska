import { describe, expect, it } from 'vitest'
import { faceParts, type FaceConnectionSets } from './faceParts'

const landmarks = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }))
let next = 0

function ring(cx: number, cy: number, rx: number, ry: number, n: number) {
  const ids = Array.from({ length: n }, (_, i) => {
    const id = next++
    const a = (i / n) * Math.PI * 2
    landmarks[id] = { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) }
    return id
  })
  return ids.map((id, i) => ({ start: id, end: ids[(i + 1) % ids.length] }))
}

// MediaPipe „lewe" to lewe oko osoby, czyli po prawej stronie obrazka.
const sets: FaceConnectionSets = {
  oval: ring(0.5, 0.5, 0.3, 0.4, 36),
  leftEyebrow: ring(0.62, 0.36, 0.06, 0.01, 8),
  rightEyebrow: ring(0.38, 0.36, 0.06, 0.01, 8),
  leftEye: ring(0.62, 0.42, 0.05, 0.02, 16),
  rightEye: ring(0.38, 0.42, 0.05, 0.02, 16),
  leftIris: ring(0.62, 0.42, 0.015, 0.015, 4),
  rightIris: ring(0.38, 0.42, 0.015, 0.015, 4),
  lips: [...ring(0.5, 0.7, 0.1, 0.03, 20), ...ring(0.5, 0.7, 0.07, 0.002, 20)],
}

describe('faceParts', () => {
  const parts = faceParts(landmarks, 1000, 1000, sets)
  const byId = (id: string) => parts.find((part) => part.id === id)!

  it('daje wszystkie części twarzy w kolejności rysowania', () => {
    expect(parts.map((part) => part.id)).toEqual([
      'jaw', 'forehead', 'brow-left', 'brow-right', 'eye-left', 'eye-right', 'iris-left', 'iris-right', 'nose', 'mouth',
    ])
  })

  it('lewa i prawa strona według obrazka, nie według osoby', () => {
    expect(byId('eye-left').contours[0][0].x).toBeLessThan(500)
    expect(byId('eye-right').contours[0][0].x).toBeGreaterThan(500)
  })

  it('linia szczęki to dolna połowa owalu, czoło górna', () => {
    const avgY = (id: string) => {
      const line = byId(id).contours[0]
      return line.reduce((s, p) => s + p.y, 0) / line.length
    }
    expect(avgY('jaw')).toBeGreaterThan(500)
    expect(avgY('forehead')).toBeLessThan(500)
  })

  it('tęczówka jest okręgiem, a nie czworokątem z czterech punktów', () => {
    const iris = byId('iris-left').contours[0]
    expect(iris.length).toBeGreaterThan(20)
    const r = iris.map((p) => Math.hypot(p.x - 380, p.y - 420))
    expect(Math.max(...r) - Math.min(...r)).toBeLessThan(1)
  })

  it('zamknięte usta: linię między wargami rysujemy raz', () => {
    expect(byId('mouth').contours).toHaveLength(2)
  })
})
