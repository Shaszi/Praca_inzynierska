import { describe, expect, it } from 'vitest'
import { createPointFromPointerEvent, IDENTITY_VIEW, type CanvasView } from './canvasPoint'

const bounds = { left: 30, top: 50 } as DOMRect
const sample = (clientX: number, clientY: number) => ({ clientX, clientY, timeStamp: 0 })

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
