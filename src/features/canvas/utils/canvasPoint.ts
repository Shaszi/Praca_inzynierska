import type { PointerEvent as ReactPointerEvent } from 'react'
import type { Point } from '../../../types/drawing'

type PointerSample = Pick<PointerEvent, 'clientX' | 'clientY' | 'timeStamp'>

export type CanvasView = {
  scale: number
  offsetX: number
  offsetY: number
}

export const IDENTITY_VIEW: CanvasView = { scale: 1, offsetX: 0, offsetY: 0 }

export type Bounds = { minX: number; minY: number; maxX: number; maxY: number }

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

export function fitView(
  bounds: Bounds | null,
  width: number,
  height: number,
  padding: number,
  limits: { min: number; max: number },
): CanvasView {
  if (!bounds || width <= 0 || height <= 0) return IDENTITY_VIEW
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

export function lerpView(from: CanvasView, to: CanvasView, t: number, width: number, height: number): CanvasView {
  const scale = from.scale * Math.pow(to.scale / from.scale, t)
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
    timestamp: performance.timeOrigin + sample.timeStamp,
  }
}

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
