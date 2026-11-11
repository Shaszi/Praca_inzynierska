import { describe, expect, it } from 'vitest'
import { createPointFromPointerEvent, fitView, IDENTITY_VIEW, strokesBounds, type CanvasView } from './canvasPoint'

const bounds = { left: 30, top: 50 } as DOMRect
const sample = (clientX: number, clientY: number) => ({ clientX, clientY, timeStamp: 0 })
const LIMITS = { min: 0.5, max: 6 }
const stroke = (points: [number, number][]) => ({
  points: points.map(([x, y]) => ({ x, y, timestamp: 0 })),
})

/** Odwzorowanie rysunek → ekran, czyli to, co robi transformacja kontekstu 2D. */
const toScreen = (x: number, y: number, view: CanvasView) => ({
  clientX: x * view.scale + view.offsetX + bounds.left,
  clientY: y * view.scale + view.offsetY + bounds.top,
  timeStamp: 0,
})

describe('createPointFromPointerEvent', () => {
  it('bez przybliżenia odejmuje tylko pozycję płótna', () => {
    const point = createPointFromPointerEvent(sample(130, 150), bounds)
    expect(point.x).toBe(100)
    expect(point.y).toBe(100)
  })

  it('odwraca przybliżenie, więc punkt trafia we współrzędne rysunku', () => {
    const view: CanvasView = { scale: 2, offsetX: 0, offsetY: 0 }
    // Ekran 230,250 → płótno 200,200 → rysunek 100,100
    const point = createPointFromPointerEvent(sample(230, 250), bounds, view)
    expect(point.x).toBe(100)
    expect(point.y).toBe(100)
  })

  it('odwraca też przesunięcie widoku', () => {
    const view: CanvasView = { scale: 2, offsetX: -40, offsetY: 15 }
    const point = createPointFromPointerEvent(sample(230, 250), bounds, view)
    expect(point.x).toBe(120)
    expect(point.y).toBe(92.5)
  })

  // To jest niezmiennik chroniący ocenę kreski: ten sam ruch ręki musi dać te same
  // współrzędne rysunku niezależnie od przybliżenia, bo evaluateStroke porównuje
  // kreskę ze wzorcem w jednym układzie.
  it('ten sam punkt rysunku wychodzi tak samo przy każdym przybliżeniu', () => {
    const views: CanvasView[] = [
      IDENTITY_VIEW,
      { scale: 0.5, offsetX: 0, offsetY: 0 },
      { scale: 2, offsetX: -120, offsetY: 60 },
      { scale: 6, offsetX: 333, offsetY: -777 },
    ]

    for (const view of views) {
      const point = createPointFromPointerEvent(toScreen(250, 175, view), bounds, view)
      expect(point.x).toBeCloseTo(250, 6)
      expect(point.y).toBeCloseTo(175, 6)
    }
  })

  it('zachowuje punkt ujemny, czyli taki poza widokiem po przesunięciu', () => {
    const view: CanvasView = { scale: 3, offsetX: 300, offsetY: 300 }
    const point = createPointFromPointerEvent(toScreen(-40, -10, view), bounds, view)
    expect(point.x).toBeCloseTo(-40, 6)
    expect(point.y).toBeCloseTo(-10, 6)
  })
})

describe('strokesBounds', () => {
  it('obejmuje wszystkie punkty wszystkich kresek', () => {
    expect(
      strokesBounds([
        stroke([
          [10, 40],
          [30, 5],
        ]),
        stroke([[70, 20]]),
      ]),
    ).toEqual({ minX: 10, minY: 5, maxX: 70, maxY: 40 })
  })

  it('bez kresek nie ma obrysu', () => {
    expect(strokesBounds([])).toBeNull()
    expect(strokesBounds([stroke([])])).toBeNull()
  })
})

describe('fitView', () => {
  it('bez obrysu zostawia widok 1:1', () => {
    expect(fitView(null, 800, 600, 28, LIMITS)).toEqual(IDENTITY_VIEW)
  })

  it('wpisuje obrys w kadr i stawia go na środku', () => {
    const box = { minX: 70, minY: 70, maxX: 550, maxY: 340 }
    const width = 1000
    const height = 500
    const view = fitView(box, width, height, 28, LIMITS)

    // Skala jest ciaśniejsza z dwóch osi, więc wzorzec mieści się w całości.
    const left = box.minX * view.scale + view.offsetX
    const right = box.maxX * view.scale + view.offsetX
    const top = box.minY * view.scale + view.offsetY
    const bottom = box.maxY * view.scale + view.offsetY
    expect(left).toBeGreaterThanOrEqual(28 - 0.001)
    expect(right).toBeLessThanOrEqual(width - 28 + 0.001)
    expect(top).toBeGreaterThanOrEqual(28 - 0.001)
    expect(bottom).toBeLessThanOrEqual(height - 28 + 0.001)

    // Wyśrodkowanie: tyle samo miejsca z lewej co z prawej, z góry co z dołu.
    expect(left).toBeCloseTo(width - right, 6)
    expect(top).toBeCloseTo(height - bottom, 6)
  })

  it('nie dzieli przez zero na pionowej kresce', () => {
    const view = fitView({ minX: 100, minY: 0, maxX: 100, maxY: 200 }, 800, 600, 28, LIMITS)
    expect(Number.isFinite(view.scale)).toBe(true)
    expect(Number.isFinite(view.offsetX)).toBe(true)
    expect(Number.isFinite(view.offsetY)).toBe(true)
  })

  it('trzyma się granic skali', () => {
    // Punktowy wzorzec chciałby skali setek — przycinamy do maksimum płótna.
    expect(fitView({ minX: 0, minY: 0, maxX: 1, maxY: 1 }, 1000, 800, 28, LIMITS).scale).toBe(6)
    // Ogromny wzorzec nie może zejść poniżej minimum.
    expect(fitView({ minX: 0, minY: 0, maxX: 90000, maxY: 90000 }, 1000, 800, 28, LIMITS).scale).toBe(0.5)
  })

  it('odwraca się punkt w punkt, więc kreska wraca do układu wzorca', () => {
    const box = { minX: 70, minY: 70, maxX: 550, maxY: 340 }
    const view = fitView(box, 1000, 500, 28, LIMITS)
    const drawing = { x: 231, y: 184 }
    // Tam, gdzie ten punkt wzorca ląduje na ekranie, użytkownik stawia kursor...
    const screen = { x: drawing.x * view.scale + view.offsetX, y: drawing.y * view.scale + view.offsetY }
    const origin = { left: 0, top: 0 } as DOMRect
    const back = createPointFromPointerEvent(
      { clientX: screen.x, clientY: screen.y, timeStamp: 0 },
      origin,
      view,
    )
    // ...a zapisuje się dokładnie ten sam punkt wzorca, więc ocena porównuje to samo.
    expect(back.x).toBeCloseTo(drawing.x, 6)
    expect(back.y).toBeCloseTo(drawing.y, 6)
  })
})
