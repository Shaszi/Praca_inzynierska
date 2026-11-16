import { describe, expect, it } from 'vitest'
import { buildSteps, fitStrokesToSquare, groupForLabeling, regionsFromLocated } from './aiImageGuide'
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

describe('buildSteps', () => {
  const contour = (n: number) => Array.from({ length: n }, (_, i) => ({ x: i, y: i }))
  const plan = [
    { points: contour(5), role: 'outline' as const, part: { id: 'jaw', name: 'Linia szczęki' } },
    { points: contour(6), role: 'structure' as const, part: { id: 'eye-left', name: 'Oko — lewa strona' } },
    { points: contour(7), role: 'detail' as const, part: { id: 'hair-strands', name: 'Kosmyki włosów' } },
  ]
  const label = (i: number, title: string, background = false) => ({ i, title, description: 'Opis', background })

  it('zachowuje kolejność planu, a nie kolejność nazw od modelu', () => {
    const steps = buildSteps(plan, [label(2, 'Oko'), label(0, 'Głowa'), label(1, 'Szyja')], true)
    expect(steps.map((s) => s.title)).toEqual(['Głowa', 'Szyja', 'Oko'])
    expect(steps.map((s) => s.id)).toEqual(['step-0', 'step-1', 'step-2'])
  })

  it('każdy krok ma dokładnie jedną linię', () => {
    for (const step of buildSteps(plan, [], true)) expect(step.strokes).toHaveLength(1)
  })

  it('krok bez nazwy od modelu dostaje nazwę swojej części zamiast wypaść', () => {
    const steps = buildSteps(plan, [], true)
    expect(steps.map((s) => s.title)).toEqual(['Linia szczęki', 'Oko — lewa strona', 'Kosmyki włosów'])
  })

  it('każdy krok wie, do której części należy', () => {
    expect(buildSteps(plan, [], true).map((s) => s.part?.id)).toEqual(['jaw', 'eye-left', 'hair-strands'])
  })

  it('z maską ignoruje znacznik tła, bez maski usuwa linię tła', () => {
    const labels = [label(0, 'Głowa'), label(1, 'Ściana', true), label(2, 'Oko')]
    expect(buildSteps(plan, labels, true)).toHaveLength(3)
    expect(buildSteps(plan, labels, false).map((s) => s.title)).toEqual(['Głowa', 'Oko'])
  })
})

describe('groupForLabeling', () => {
  const line = (x: number, y: number, size = 10) => [{ x, y }, { x: x + size, y: y + size }]
  const step = (id: string, x: number, y: number, size?: number) => ({
    points: line(x, y, size),
    role: 'detail' as const,
    part: { id, name: id },
  })
  const plan = [
    step('jaw', 100, 300, 200),
    step('eye-left', 150, 200),
    step('hair-strands', 50, 20, 300),
    step('iris-right', 250, 200),
    step('brow-left', 150, 180),
    step('silhouette', 0, 400, 400),
  ]

  it('oczy, brwi i tęczówki trafiają do jednej grupy, reszta osobno', () => {
    const groups = groupForLabeling(plan, 500, 600)
    expect(groups.map((g) => [g.focus, g.indices])).toEqual([
      ['face', [0]],
      ['eyes', [1, 3, 4]],
      ['hair', [2]],
      [null, [5]],
    ])
  })

  it('wycinek oczu obejmuje wszystkie ich linie, a reszta idzie na całym zdjęciu', () => {
    const groups = groupForLabeling(plan, 500, 600)
    const eyes = groups.find((g) => g.focus === 'eyes')!.box!
    expect(eyes.x).toBeLessThanOrEqual(150)
    expect(eyes.y).toBeLessThanOrEqual(180)
    expect(eyes.x + eyes.w).toBeGreaterThanOrEqual(260)
    expect(eyes.y + eyes.h).toBeGreaterThanOrEqual(210)
    expect(eyes.w).toBeLessThan(250)
    expect(groups.find((g) => g.focus === null)!.box).toBeNull()
  })

  it('wycinek nie wychodzi poza zdjęcie', () => {
    const [hair] = groupForLabeling([step('hair-outline', 0, 0, 500)], 500, 500)
    expect(hair.box).toEqual({ x: 0, y: 0, w: 500, h: 500 })
  })
})

describe('regionsFromLocated', () => {
  it('zamienia ramki 0–1 na piksele z zapasem, w kolejności brwi → oczy → nos → usta → włosy', () => {
    const regions = regionsFromLocated(
      [
        { kind: 'mouth', x0: 0.4, y0: 0.7, x1: 0.6, y1: 0.8 },
        { kind: 'eye-left', x0: 0.3, y0: 0.4, x1: 0.4, y1: 0.45 },
        { kind: 'toString', x0: 0, y0: 0, x1: 1, y1: 1 },
      ],
      1000,
      1000,
    )
    expect(regions.map((r) => [r.id, r.name])).toEqual([
      ['eye-left', 'Oko — lewa strona'],
      ['mouth', 'Usta'],
    ])
    const eye = regions[0].box
    expect(eye.minX).toBeLessThan(300)
    expect(eye.maxX).toBeGreaterThan(400)
    expect(eye.minY).toBeLessThan(400)
    expect(eye.maxY).toBeGreaterThan(450)
  })

  it('ramka przy krawędzi nie wychodzi poza zdjęcie', () => {
    const [hair] = regionsFromLocated([{ kind: 'hair-strands', x0: 0, y0: 0, x1: 1, y1: 0.5 }], 400, 600)
    expect(hair.box).toEqual({ minX: 0, minY: 0, maxX: 400, maxY: 390 })
  })
})
