import { describe, expect, it } from 'vitest'
import { fitStrokesToSquare, splitToSingleContourSteps } from './aiImageGuide'
import type { Stroke } from '../types/drawing'

const stroke = (points: [number, number][]): Stroke => ({
  points: points.map(([x, y]) => ({ x, y, timestamp: 0 })),
  brushSize: 4,
})

const place = (view: { scale: number; offsetX: number; offsetY: number }, x: number, y: number) => ({
  x: x * view.scale + view.offsetX,
  y: y * view.scale + view.offsetY,
})

describe('fitStrokesToSquare', () => {
  it('bez kresek nie przesuwa niczego', () => {
    expect(fitStrokesToSquare([])).toEqual({ scale: 1, offsetX: 0, offsetY: 0 })
  })

  // To jest ten błąd: współrzędne płótna 1200x800 szły wprost na obrazek 512x512,
  // więc wszystko poza lewym górnym narożnikiem nie docierało do modelu.
  it('mieści kreskę narysowaną daleko poza kwadratem 512 px', () => {
    const view = fitStrokesToSquare([stroke([[900, 700], [1100, 740]])])

    for (const [x, y] of [[900, 700], [1100, 740]] as const) {
      const point = place(view, x, y)
      expect(point.x).toBeGreaterThanOrEqual(0)
      expect(point.x).toBeLessThanOrEqual(512)
      expect(point.y).toBeGreaterThanOrEqual(0)
      expect(point.y).toBeLessThanOrEqual(512)
    }
  })

  it('zostawia margines i centruje krótszą osią', () => {
    const view = fitStrokesToSquare([stroke([[0, 0], [100, 50]])])

    expect(view.scale).toBeCloseTo((512 - 48) / 100)
    expect(place(view, 0, 0).x).toBeCloseTo(24)
    expect(place(view, 0, 0).y).toBeCloseTo(140)
    expect(place(view, 100, 50).x).toBeCloseTo(488)
    expect(place(view, 100, 50).y).toBeCloseTo(372)
  })

  it('nie rozciąga rysunku — jedna skala na obie osie', () => {
    const view = fitStrokesToSquare([stroke([[10, 10], [410, 110]])])
    const a = place(view, 10, 10)
    const b = place(view, 410, 110)

    // Proporcja 400:100 z rysunku musi zostać proporcją 4:1 na obrazku.
    expect((b.x - a.x) / (b.y - a.y)).toBeCloseTo(4)
  })

  it('radzi sobie z kreską bez rozpiętości — jeden punkt nie dzieli przez zero', () => {
    const view = fitStrokesToSquare([stroke([[300, 300]])])

    expect(Number.isFinite(view.scale)).toBe(true)
    const point = place(view, 300, 300)
    expect(point.x).toBeGreaterThanOrEqual(0)
    expect(point.x).toBeLessThanOrEqual(512)
  })
})

describe('splitToSingleContourSteps', () => {
  const contour = (n: number) => Array.from({ length: n }, (_, i) => ({ x: i, y: i }))
  const contours = [contour(5), contour(6), contour(7), contour(8)]

  it('krok z jednym konturem zostaje jednym krokiem', () => {
    const steps = splitToSingleContourSteps([{ title: 'Uchwyt', description: 'Łukiem', contours: [2] }], contours)
    expect(steps).toHaveLength(1)
    expect(steps[0].title).toBe('Uchwyt')
    expect(steps[0].strokes).toHaveLength(1)
  })

  // To jest reguła, dla której ta funkcja istnieje: ocena porównuje kreskę z jedną linią.
  it('każdy krok ma dokładnie jedną linię', () => {
    const steps = splitToSingleContourSteps(
      [
        { title: 'Obrys', description: 'Od góry', contours: [0, 1] },
        { title: 'Detale', description: 'Drobne', contours: [2, 3] },
      ],
      contours,
    )
    expect(steps).toHaveLength(4)
    for (const step of steps) expect(step.strokes).toHaveLength(1)
  })

  it('numeruje tytuł, gdy rzecz rozpada się na kilka linii', () => {
    const steps = splitToSingleContourSteps([{ title: 'Obrys', description: 'x', contours: [0, 1, 2] }], contours)
    expect(steps.map((s) => s.title)).toEqual(['Obrys (1 z 3)', 'Obrys (2 z 3)', 'Obrys (3 z 3)'])
  })

  it('pomija numery konturów, których nie ma', () => {
    const steps = splitToSingleContourSteps([{ title: 'Obrys', description: 'x', contours: [0, 99] }], contours)
    expect(steps).toHaveLength(1)
    expect(steps[0].title).toBe('Obrys')
  })

  it('nadaje krokom kolejne identyfikatory mimo rozbicia', () => {
    const steps = splitToSingleContourSteps(
      [
        { title: 'A', description: 'x', contours: [0, 1] },
        { title: 'B', description: 'x', contours: [2] },
      ],
      contours,
    )
    expect(steps.map((s) => s.id)).toEqual(['step-0', 'step-1', 'step-2'])
  })
})
