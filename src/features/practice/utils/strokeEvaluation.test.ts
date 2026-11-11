import { describe, expect, it } from 'vitest'
import type { Point, Stroke } from '../../../types/drawing'
import { evaluateStroke, liveProgress } from './strokeEvaluation'

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

describe('liveProgress', () => {
  it('daje 100 na linii i mało daleko od niej', () => {
    expect(liveProgress(asStroke(drawn(() => 300, { to: 0.4 })), reference)!.accuracy).toBe(100)
    expect(liveProgress(asStroke(drawn(() => 360, { to: 0.4 })), reference)!.accuracy).toBeLessThan(40)
  })

  it('pokrycie rośnie razem z narysowaną częścią wzoru', () => {
    const at = (to: number) => liveProgress(asStroke(drawn(() => 300, { to })), reference)!.coverage
    expect(at(0.25)).toBeGreaterThan(15)
    expect(at(0.25)).toBeLessThan(35)
    expect(at(0.5)).toBeGreaterThan(40)
    expect(at(0.5)).toBeLessThan(60)
    expect(at(1)).toBeGreaterThan(95)
  })

  it('pokrycie jest monotoniczne wzdłuż wzoru', () => {
    const values = [0.2, 0.4, 0.6, 0.8, 1].map(
      (to) => liveProgress(asStroke(drawn(() => 300, { to })), reference)!.coverage,
    )
    for (let i = 1; i < values.length; i++) expect(values[i]).toBeGreaterThanOrEqual(values[i - 1])
  })

  it('kreska poza marginesem błędu nie zapełnia paska', () => {
    const far = liveProgress(asStroke(drawn(() => 500, { to: 1 })), reference)!
    expect(far.coverage).toBe(0)
    expect(far.accuracy).toBeLessThan(40)
  })

  it('kreślenie w jednym miejscu nie zapełnia paska', () => {
    const scribble = liveProgress(asStroke(drawn(() => 300, { to: 0.05 })), reference)!
    expect(scribble.coverage).toBeLessThan(10)
    expect(scribble.accuracy).toBe(100)
  })

  it('ruch tam i z powrotem nie liczy pokrycia dwa razy', () => {
    const forward = drawn(() => 300, { to: 0.5 })
    const thereAndBack = asStroke([...forward, ...[...forward].reverse().map((p, i) => ({ ...p, timestamp: p.timestamp + 2000 + i }))])
    const once = liveProgress(asStroke(forward), reference)!.coverage
    expect(liveProgress(thereAndBack, reference)!.coverage).toBe(once)
  })

  it('margines błędu rośnie z długością wzoru i grubością kreski', () => {
    const thin = liveProgress(asStroke(drawn(() => 300, { to: 0.5 })), reference)!.tolerancePx
    const thick = liveProgress(asStroke(drawn(() => 300, { to: 0.5 })), { ...reference, brushSize: 40 })!.tolerancePx
    expect(thick).toBeGreaterThan(thin)
  })
})
