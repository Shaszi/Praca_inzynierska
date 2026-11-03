import type { PointerEvent as ReactPointerEvent } from 'react'
import type { Point } from '../../../types/drawing'

type PointerSample = Pick<PointerEvent, 'clientX' | 'clientY' | 'timeStamp'>

export function createPointFromPointerEvent(sample: PointerSample, bounds: DOMRect): Point {
  return {
    x: sample.clientX - bounds.left,
    y: sample.clientY - bounds.top,
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
): Point[] {
  const bounds = canvas.getBoundingClientRect()
  const native = event.nativeEvent
  const coalesced = typeof native.getCoalescedEvents === 'function' ? native.getCoalescedEvents() : []
  const samples = coalesced.length > 0 ? coalesced : [native]
  return samples.map((sample) => createPointFromPointerEvent(sample, bounds))
}
