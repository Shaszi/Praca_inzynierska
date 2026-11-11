import { describe, expect, it } from 'vitest'
import { fitStrokesToSquare } from './aiImageGuide'
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
