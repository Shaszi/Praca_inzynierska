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
