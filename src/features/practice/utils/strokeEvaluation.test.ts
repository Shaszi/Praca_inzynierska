import { describe, expect, it } from 'vitest'
import type { Point, Stroke } from '../../../types/drawing'
import { evaluateStroke, liveAccuracy } from './strokeEvaluation'

// Wzorzec: pozioma linia 500 px, jak zapisana w edytorze (punkty co 3 px).
const reference: Stroke = {
  brushSize: 5,
  points: Array.from({ length: 168 }, (_, i) => ({ x: 100 + i * 3, y: 300, timestamp: i })),
}

/** Kreska użytkownika wzdłuż funkcji y(t), t ∈ [0, 1], rysowana z prędkością `speed` px/s. */
function drawn(y: (t: number) => number, opts: { from?: number; to?: number; speed?: number; jitter?: (t: number) => number } = {}) {
  const { from = 0, to = 1, speed = 400, jitter = () => 0 } = opts
  const points: Point[] = []
  const length = 500 * (to - from)
  const count = Math.round(length / 2)
  for (let i = 0; i <= count; i++) {
    const t = from + ((to - from) * i) / count
    const sign = i % 2 === 0 ? 1 : -1
    points.push({ x: 100 + 500 * t, y: y(t) + sign * jitter(t), timestamp: 1000 + ((i * 2) / speed) * 1000 })
  }
  return points
}

const asStroke = (points: Point[]): Stroke => ({ brushSize: 5, points })

describe('evaluateStroke', () => {
  it('chwali kreskę zgodną ze wzorcem', () => {
    const raw = drawn(() => 300)
    const result = evaluateStroke(asStroke(raw), reference, raw)
    expect(result.score).toBeGreaterThanOrEqual(95)
    expect(result.level).toBe('good')
    expect(result.summary).toBe('Cała linia jest świetna i płynna.')
    expect(result.worstPoint).toBeNull()
  })

  it('wykrywa drżenie na początku na surowych punktach, mimo wygładzonej kreski', () => {
    const raw = drawn(() => 300, { jitter: (t) => (t < 0.3 ? 2.5 : 0) })
    const smoothed = drawn(() => 300)
    const result = evaluateStroke(asStroke(smoothed), reference, raw)
    expect(result.segments[0].issues[0].kind).toBe('tremor')
    expect(result.segments[0].level).toBe('bad')
    expect(result.summary).toBe('Początek linii jest zły, bo za bardzo drży. Środek i koniec linii są świetne i płynne.')
  })

  it('opisuje kierunek i wielkość ucieczki od wzoru', () => {
    const bump = (t: number) => (t > 1 / 3 && t < 2 / 3 ? Math.sin((t - 1 / 3) * 3 * Math.PI) : 0)
    const raw = drawn((t) => 300 - 60 * bump(t))
    const result = evaluateStroke(asStroke(raw), reference, raw)
    const middle = result.segments[1]
    expect(middle.issues[0].kind).toBe('offset')
    expect(middle.issues[0].label).toBe('ucieka w górę')
    expect(result.summary).toMatch(/^Środek linii jest zły, bo ucieka w górę o ok\. \d+ px\./)
    expect(result.worstPoint?.y).toBeLessThan(260)
    expect(result.score).toBeLessThan(80)
  })

  it('akceptuje rysowanie w odwrotnym kierunku', () => {
    const raw = drawn(() => 300).map((p, i, all) => ({ ...p, x: all[all.length - 1 - i].x }))
    const result = evaluateStroke(asStroke(raw), reference, raw)
    expect(result.reversed).toBe(true)
    expect(result.level).toBe('good')
  })

  it('zauważa zatrzymanie ruchu przy końcu linii', () => {
    const raw = drawn(() => 300)
    const pauseAt = Math.round(raw.length * 0.8)
    const withPause = raw.map((p, i) => (i >= pauseAt ? { ...p, timestamp: p.timestamp + 400 } : p))
    const result = evaluateStroke(asStroke(withPause), reference, withPause)
    expect(result.segments[2].pauses).toBe(1)
    expect(result.summary).toContain('Koniec linii ma zatrzymanie ruchu.')
  })

  it('mówi, że linia jest za krótka, zamiast wymieniać chybiony koniec', () => {
    const raw = drawn(() => 300, { to: 0.6 })
    const result = evaluateStroke(asStroke(raw), reference, raw)
    expect(result.summary).toBe('Prowadzenie linii jest świetne i płynne. Linia jest za krótka o 40%.')
  })

  it('nie uznaje drżącej linii za zbyt długą', () => {
    const raw = drawn(() => 300, { jitter: (t) => (t < 0.33 ? 4 : 0) })
    const result = evaluateStroke(asStroke(raw), reference, raw)
    expect(result.summary).not.toContain('za długa')
    expect(result.lengthRatio).toBeGreaterThan(0.97)
  })

  it('wskazuje przeciągnięcie linii za punkt końcowy', () => {
    const raw = drawn(() => 300, { to: 1.2 })
    const result = evaluateStroke(asStroke(raw), reference, raw)
    expect(result.summary).toBe('Prowadzenie linii jest świetne i płynne. Koniec mija punkt końcowy o 99 px.')
  })

  it('przy uciekającym środku mówi o kierunku, a nie o kącie', () => {
    const bump = (t: number) => (t > 1 / 3 && t < 2 / 3 ? Math.sin((t - 1 / 3) * 3 * Math.PI) : 0)
    const raw = drawn((t) => 300 + 45 * bump(t))
    const result = evaluateStroke(asStroke(raw), reference, raw)
    expect(result.segments[1].issues.map((i) => i.kind)).not.toContain('angle')
    expect(result.summary).toMatch(/^Środek linii jest zły, bo ucieka w dół o ok\. \d+ px\./)
  })

  it('odrzuca kliknięcie zamiast kreski', () => {
    const raw = drawn(() => 300, { to: 0.02 })
    const result = evaluateStroke(asStroke(raw), reference, raw)
    expect(result.tooShort).toBe(true)
    expect(result.score).toBe(0)
  })

  it('zgłasza zbyt wolne rysowanie', () => {
    const raw = drawn(() => 300, { speed: 35 })
    const result = evaluateStroke(asStroke(raw), reference, raw)
    expect(result.summary).toContain('Ruch jest za wolny')
  })
})

describe('liveAccuracy', () => {
  it('daje 100 na linii i mało daleko od niej', () => {
    expect(liveAccuracy(asStroke(drawn(() => 300, { to: 0.4 })), reference)).toBe(100)
    expect(liveAccuracy(asStroke(drawn(() => 360, { to: 0.4 })), reference)!).toBeLessThan(40)
  })
})
