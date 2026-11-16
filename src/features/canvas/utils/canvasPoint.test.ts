import { describe, expect, it } from 'vitest'
import { angleDelta, centerView, createPointFromPointerEvent, fitView, IDENTITY_VIEW, lerpView, strokesBounds, toDrawing, toScreen as projectToScreen, type CanvasView } from './canvasPoint'

const bounds = { left: 30, top: 50 } as DOMRect
const sample = (clientX: number, clientY: number) => ({ clientX, clientY, timeStamp: 0 })
const LIMITS = { min: 0.5, max: 6 }
const stroke = (points: [number, number][]) => ({
  points: points.map(([x, y]) => ({ x, y, timestamp: 0 })),
})

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

    const left = box.minX * view.scale + view.offsetX
    const right = box.maxX * view.scale + view.offsetX
    const top = box.minY * view.scale + view.offsetY
    const bottom = box.maxY * view.scale + view.offsetY
    expect(left).toBeGreaterThanOrEqual(28 - 0.001)
    expect(right).toBeLessThanOrEqual(width - 28 + 0.001)
    expect(top).toBeGreaterThanOrEqual(28 - 0.001)
    expect(bottom).toBeLessThanOrEqual(height - 28 + 0.001)

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
    expect(fitView({ minX: 0, minY: 0, maxX: 1, maxY: 1 }, 1000, 800, 28, LIMITS).scale).toBe(6)
    expect(fitView({ minX: 0, minY: 0, maxX: 90000, maxY: 90000 }, 1000, 800, 28, LIMITS).scale).toBe(0.5)
  })

  it('odwraca się punkt w punkt, więc kreska wraca do układu wzorca', () => {
    const box = { minX: 70, minY: 70, maxX: 550, maxY: 340 }
    const view = fitView(box, 1000, 500, 28, LIMITS)
    const drawing = { x: 231, y: 184 }
    const screen = { x: drawing.x * view.scale + view.offsetX, y: drawing.y * view.scale + view.offsetY }
    const origin = { left: 0, top: 0 } as DOMRect
    const back = createPointFromPointerEvent(
      { clientX: screen.x, clientY: screen.y, timeStamp: 0 },
      origin,
      view,
    )
    expect(back.x).toBeCloseTo(drawing.x, 6)
    expect(back.y).toBeCloseTo(drawing.y, 6)
  })
})

describe('centerView', () => {
  const box = (minX: number, minY: number, maxX: number, maxY: number) => ({ minX, minY, maxX, maxY })
  const centerOf = (b: ReturnType<typeof box>, view: CanvasView) => ({
    x: ((b.minX + b.maxX) / 2) * view.scale + view.offsetX,
    y: ((b.minY + b.maxY) / 2) * view.scale + view.offsetY,
  })

  it('linia przy krawędzi trafia na środek ekranu, bez zmiany skali', () => {
    const line = box(650, 80, 750, 120)
    const view = centerView(IDENTITY_VIEW, line, 800, 600, 20, LIMITS)!
    expect(view.scale).toBe(1)
    expect(centerOf(line, view).x).toBeCloseTo(400)
    expect(centerOf(line, view).y).toBeCloseTo(300)
  })

  it('linia już na środku — kadr stoi', () => {
    expect(centerView(IDENTITY_VIEW, box(380, 280, 420, 320), 800, 600, 20, LIMITS)).toBeNull()
  })

  it('linia większa niż ekran — oddala, ale nigdy nie przybliża', () => {
    const zoomed = { scale: 4, offsetX: 0, offsetY: 0 }
    expect(centerView(zoomed, box(0, 0, 400, 100), 800, 600, 20, LIMITS)!.scale).toBeLessThan(4)
    expect(centerView(IDENTITY_VIEW, box(700, 500, 710, 510), 800, 600, 20, LIMITS)!.scale).toBe(1)
  })
})

describe('lerpView', () => {
  const from = { scale: 1, offsetX: 0, offsetY: 0 }
  const to = { scale: 4, offsetX: -300, offsetY: -200 }

  it('na końcach daje widoki wejściowe', () => {
    const start = lerpView(from, to, 0, 800, 600)
    const end = lerpView(from, to, 1, 800, 600)
    expect(start.scale).toBeCloseTo(1)
    expect(start.offsetX).toBeCloseTo(0)
    expect(end.scale).toBeCloseTo(4)
    expect(end.offsetX).toBeCloseTo(-300)
    expect(end.offsetY).toBeCloseTo(-200)
  })

  it('w połowie skala jest średnią geometryczną', () => {
    expect(lerpView(from, to, 0.5, 800, 600).scale).toBeCloseTo(2)
  })
})

describe('obrót płótna', () => {
  const rotated: CanvasView = { scale: 2, offsetX: 300, offsetY: 120, rotation: 1.1 }

  it('ten sam punkt rysunku po drodze ekran → rysunek, także po obrocie', () => {
    for (const p of [{ x: 0, y: 0 }, { x: 140, y: -60 }, { x: 512, y: 300 }]) {
      const back = toDrawing(projectToScreen(p, rotated), rotated)
      expect(back.x).toBeCloseTo(p.x, 6)
      expect(back.y).toBeCloseTo(p.y, 6)
    }
  })

  it('dotyk na obróconym płótnie zapisuje punkt rysunku pod palcem', () => {
    const screen = projectToScreen({ x: 80, y: 40 }, rotated)
    const point = createPointFromPointerEvent(sample(screen.x + bounds.left, screen.y + bounds.top), bounds, rotated)
    expect(point.x).toBeCloseTo(80, 6)
    expect(point.y).toBeCloseTo(40, 6)
  })

  it('obrót o 90° kładzie oś X rysunku pionowo na ekranie', () => {
    const quarter = { scale: 1, offsetX: 0, offsetY: 0, rotation: Math.PI / 2 }
    const p = projectToScreen({ x: 10, y: 0 }, quarter)
    expect(p.x).toBeCloseTo(0, 6)
    expect(p.y).toBeCloseTo(10, 6)
  })

  it('animacja obrotu idzie krótszą drogą przez 0°', () => {
    expect(angleDelta(Math.PI * 1.9, Math.PI * 0.1)).toBeCloseTo(Math.PI * 0.2, 6)
    const half = lerpView({ ...IDENTITY_VIEW, rotation: -0.2 }, { ...IDENTITY_VIEW, rotation: 0.2 }, 0.5, 800, 600)
    expect(half.rotation).toBeCloseTo(0, 6)
  })

  it('centrowanie na obróconym płótnie kładzie linię na środku i nie zmienia obrotu', () => {
    const line = { minX: 600, minY: 40, maxX: 700, maxY: 80 }
    const view = centerView({ scale: 1, offsetX: 0, offsetY: 0, rotation: 0.7 }, line, 800, 600, 20, LIMITS)!
    const middle = projectToScreen({ x: 650, y: 60 }, view)
    expect(middle.x).toBeCloseTo(400, 4)
    expect(middle.y).toBeCloseTo(300, 4)
    expect(view.rotation).toBe(0.7)
  })
})
