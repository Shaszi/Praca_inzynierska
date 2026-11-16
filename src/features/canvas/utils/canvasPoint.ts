import type { PointerEvent as ReactPointerEvent } from 'react'
import type { Point } from '../../../types/drawing'

type PointerSample = Pick<PointerEvent, 'clientX' | 'clientY' | 'timeStamp'>

/** Przybliżenie i przesunięcie widoku. Skala 1 i zerowe przesunięcie = brak transformacji. */
export type CanvasView = {
  scale: number
  offsetX: number
  offsetY: number
}

export const IDENTITY_VIEW: CanvasView = { scale: 1, offsetX: 0, offsetY: 0 }

/** Prostokąt w układzie rysunku. */
export type Bounds = { minX: number; minY: number; maxX: number; maxY: number }

/** Prostokąt obejmujący wszystkie punkty. `null`, gdy nie ma czego obejmować. */
export function strokesBounds(strokes: { points: Point[] }[]): Bounds | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const stroke of strokes) {
    for (const point of stroke.points) {
      if (point.x < minX) minX = point.x
      if (point.y < minY) minY = point.y
      if (point.x > maxX) maxX = point.x
      if (point.y > maxY) maxY = point.y
    }
  }
  return minX === Infinity ? null : { minX, minY, maxX, maxY }
}

/**
 * Widok wpisujący `bounds` w płótno: wzorzec wypełnia kadr i stoi na środku, zamiast
 * siedzieć tam, gdzie akurat narysowano go w innym oknie. Skala jest wspólna dla osi X i Y,
 * więc nic się nie rozciąga, i jest to zwykły `CanvasView` — kreski użytkownika przechodzą
 * przez `createPointFromPointerEvent`, które go odwraca, więc ocena dalej porównuje
 * wzorzec i kreskę w jednym układzie.
 */
export function fitView(
  bounds: Bounds | null,
  width: number,
  height: number,
  padding: number,
  limits: { min: number; max: number },
): CanvasView {
  if (!bounds || width <= 0 || height <= 0) return IDENTITY_VIEW
  // Zero-wymiarowy wzorzec (pionowa kreska) nie może dzielić przez zero ani wymuszać
  // skali z osi, której nie ma — stąd dolna granica 1 px.
  const boxWidth = Math.max(1, bounds.maxX - bounds.minX)
  const boxHeight = Math.max(1, bounds.maxY - bounds.minY)
  const usableWidth = Math.max(1, width - 2 * padding)
  const usableHeight = Math.max(1, height - 2 * padding)
  const scale = Math.min(limits.max, Math.max(limits.min, Math.min(usableWidth / boxWidth, usableHeight / boxHeight)))
  return {
    scale,
    offsetX: (width - boxWidth * scale) / 2 - bounds.minX * scale,
    offsetY: (height - boxHeight * scale) / 2 - bounds.minY * scale,
  }
}

/**
 * Widok, w którym cały obrys `bounds` jest na ekranie, albo `null`, gdy już jest.
 * Najmniejsza zmiana, jaka wystarczy: obrys mieści się w obecnej skali — tylko przesuwamy
 * (dosuwając do krawędzi, nie centrując, żeby kadr nie skakał bez potrzeby); nie mieści
 * się — oddalamy do skali, w której wejdzie, i centrujemy na nim.
 */
export function revealView(
  view: CanvasView,
  bounds: Bounds,
  width: number,
  height: number,
  padding: number,
  limits: { min: number; max: number },
): CanvasView | null {
  const usableWidth = Math.max(1, width - 2 * padding)
  const usableHeight = Math.max(1, height - 2 * padding)
  const boxWidth = Math.max(1, bounds.maxX - bounds.minX)
  const boxHeight = Math.max(1, bounds.maxY - bounds.minY)

  const left = bounds.minX * view.scale + view.offsetX
  const top = bounds.minY * view.scale + view.offsetY
  const right = bounds.maxX * view.scale + view.offsetX
  const bottom = bounds.maxY * view.scale + view.offsetY
  const visible = left >= padding - 0.5 && top >= padding - 0.5 && right <= width - padding + 0.5 && bottom <= height - padding + 0.5
  if (visible) return null

  if (boxWidth * view.scale <= usableWidth && boxHeight * view.scale <= usableHeight) {
    // Przesunięcie o tyle, ile obrys wystaje poza kadr z danej strony.
    const dx = left < padding ? padding - left : right > width - padding ? width - padding - right : 0
    const dy = top < padding ? padding - top : bottom > height - padding ? height - padding - bottom : 0
    return { scale: view.scale, offsetX: view.offsetX + dx, offsetY: view.offsetY + dy }
  }

  const scale = Math.max(limits.min, Math.min(limits.max, usableWidth / boxWidth, usableHeight / boxHeight))
  return {
    scale,
    offsetX: width / 2 - ((bounds.minX + bounds.maxX) / 2) * scale,
    offsetY: height / 2 - ((bounds.minY + bounds.maxY) / 2) * scale,
  }
}

/**
 * Widok pośredni między `from` i `to` dla `t` od 0 do 1. Skala interpolowana
 * logarytmicznie — przy liniowej oddalanie wygląda, jakby zwalniało pod koniec.
 */
export function lerpView(from: CanvasView, to: CanvasView, t: number, width: number, height: number): CanvasView {
  const scale = from.scale * Math.pow(to.scale / from.scale, t)
  // Jednostajnie jedzie punkt rysunku na środku ekranu — offset liczymy z niego,
  // a nie interpolujemy wprost, bo wtedy przy zmianie skali obraz zatacza łuk.
  const cx = width / 2
  const cy = height / 2
  const fromX = (cx - from.offsetX) / from.scale
  const fromY = (cy - from.offsetY) / from.scale
  const toX = (cx - to.offsetX) / to.scale
  const toY = (cy - to.offsetY) / to.scale
  return {
    scale,
    offsetX: cx - (fromX + (toX - fromX) * t) * scale,
    offsetY: cy - (fromY + (toY - fromY) * t) * scale,
  }
}

/**
 * Punkty zapisujemy w układzie rysunku, nie ekranu — inaczej po przybliżeniu kreska
 * wylądowałaby w innym miejscu niż wzorzec i ocena porównywałaby nieporównywalne.
 * Dlatego transformacja widoku jest tu odwracana.
 */
export function createPointFromPointerEvent(
  sample: PointerSample,
  bounds: DOMRect,
  view: CanvasView = IDENTITY_VIEW,
): Point {
  const screenX = sample.clientX - bounds.left
  const screenY = sample.clientY - bounds.top
  return {
    x: (screenX - view.offsetX) / view.scale,
    y: (screenY - view.offsetY) / view.scale,
    // High-resolution epoch time; Date.now() has 1 ms (or coarser) resolution,
    // which is too imprecise for velocity-based filtering
    timestamp: performance.timeOrigin + sample.timeStamp,
  }
}

// Browsers deliver at most one pointermove per frame and merge the remaining
// hardware samples into it. Reading them back recovers the full input resolution.
export function getPointsFromPointerEvent(
  event: ReactPointerEvent<HTMLCanvasElement>,
  canvas: HTMLCanvasElement,
  view: CanvasView = IDENTITY_VIEW,
): Point[] {
  const bounds = canvas.getBoundingClientRect()
  const native = event.nativeEvent
  const coalesced = typeof native.getCoalescedEvents === 'function' ? native.getCoalescedEvents() : []
  const samples = coalesced.length > 0 ? coalesced : [native]
  return samples.map((sample) => createPointFromPointerEvent(sample, bounds, view))
}
