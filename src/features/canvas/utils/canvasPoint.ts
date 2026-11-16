import type { PointerEvent as ReactPointerEvent } from 'react'
import type { Point } from '../../../types/drawing'

type PointerSample = Pick<PointerEvent, 'clientX' | 'clientY' | 'timeStamp'>

export type CanvasView = {
  scale: number
  offsetX: number
  offsetY: number
  /** Obrót płótna w radianach, zgodnie z ruchem wskazówek zegara na ekranie. */
  rotation?: number
}

type Vec = { x: number; y: number }

export function toScreen(p: Vec, view: CanvasView): Vec {
  const r = view.rotation ?? 0
  const cos = Math.cos(r)
  const sin = Math.sin(r)
  return {
    x: view.scale * (cos * p.x - sin * p.y) + view.offsetX,
    y: view.scale * (sin * p.x + cos * p.y) + view.offsetY,
  }
}

export function toDrawing(q: Vec, view: CanvasView): Vec {
  const r = view.rotation ?? 0
  const cos = Math.cos(r)
  const sin = Math.sin(r)
  const dx = (q.x - view.offsetX) / view.scale
  const dy = (q.y - view.offsetY) / view.scale
  return { x: cos * dx + sin * dy, y: -sin * dx + cos * dy }
}

/** Widok o danej skali i obrocie, w którym punkt rysunku `anchor` leży w punkcie ekranu `screen`. */
export function viewAnchored(anchor: Vec, screen: Vec, scale: number, rotation = 0): CanvasView {
  const placed = toScreen(anchor, { scale, rotation, offsetX: 0, offsetY: 0 })
  return { scale, rotation, offsetX: screen.x - placed.x, offsetY: screen.y - placed.y }
}

/** Różnica kątów sprowadzona do (-π, π] — obrót zawsze krótszą drogą. */
export function angleDelta(from: number, to: number): number {
  let d = (to - from) % (2 * Math.PI)
  if (d > Math.PI) d -= 2 * Math.PI
  if (d <= -Math.PI) d += 2 * Math.PI
  return d
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

/**
 * Widok z obrysem `bounds` na środku ekranu, albo `null`, gdy już jest blisko środka.
 * Nigdy nie przybliża; oddala tylko wtedy, gdy obrys nie mieści się w obecnej skali.
 */
export function centerView(
  view: CanvasView,
  bounds: Bounds,
  width: number,
  height: number,
  padding: number,
  limits: { min: number; max: number },
): CanvasView | null {
  const rotation = view.rotation ?? 0
  const corners = [
    { x: bounds.minX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.minY },
    { x: bounds.minX, y: bounds.maxY },
    { x: bounds.maxX, y: bounds.maxY },
  ].map((p) => toScreen(p, { scale: 1, rotation, offsetX: 0, offsetY: 0 }))
  const boxWidth = Math.max(1, Math.max(...corners.map((p) => p.x)) - Math.min(...corners.map((p) => p.x)))
  const boxHeight = Math.max(1, Math.max(...corners.map((p) => p.y)) - Math.min(...corners.map((p) => p.y)))
  const fit = Math.min(Math.max(1, width - 2 * padding) / boxWidth, Math.max(1, height - 2 * padding) / boxHeight)
  const scale = Math.max(limits.min, Math.min(limits.max, view.scale, fit))
  const center = { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 }
  const screenCenter = { x: width / 2, y: height / 2 }

  const now = toScreen(center, view)
  if (scale === view.scale && Math.hypot(now.x - screenCenter.x, now.y - screenCenter.y) < 0.08 * Math.min(width, height)) {
    return null
  }
  return viewAnchored(center, screenCenter, scale, rotation)
}

/**
 * Widok pośredni między `from` i `to` dla `t` od 0 do 1. Skala interpolowana
 * logarytmicznie, obrót krótszą drogą, a punkt rysunku na środku ekranu jedzie jednostajnie.
 */
export function lerpView(from: CanvasView, to: CanvasView, t: number, width: number, height: number): CanvasView {
  const scale = from.scale * Math.pow(to.scale / from.scale, t)
  const fromRotation = from.rotation ?? 0
  const rotation = fromRotation + angleDelta(fromRotation, to.rotation ?? 0) * t
  const screenCenter = { x: width / 2, y: height / 2 }
  const a = toDrawing(screenCenter, from)
  const b = toDrawing(screenCenter, to)
  return viewAnchored({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, screenCenter, scale, rotation)
}

export function createPointFromPointerEvent(
  sample: PointerSample,
  bounds: DOMRect,
  view: CanvasView = IDENTITY_VIEW,
): Point {
  const p = toDrawing({ x: sample.clientX - bounds.left, y: sample.clientY - bounds.top }, view)
  return { x: p.x, y: p.y, timestamp: performance.timeOrigin + sample.timeStamp }
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
