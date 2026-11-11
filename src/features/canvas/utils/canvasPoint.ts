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
