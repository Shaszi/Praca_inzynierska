import type { Point } from '../../../types/drawing'

export function distanceBetween(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function findNearestDistance(point: Point, candidates: Point[]): number {
  if (candidates.length === 0) {
    return Infinity
  }

  let nearestDistance = Infinity
  for (const candidate of candidates) {
    const distance = distanceBetween(point, candidate)
    if (distance < nearestDistance) {
      nearestDistance = distance
    }
  }

  return nearestDistance
}
