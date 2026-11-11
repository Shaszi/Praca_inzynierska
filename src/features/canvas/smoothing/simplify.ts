import type { Point } from '../../../types/drawing'

function distanceToSegment(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y)

  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared))
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy))
}

// Ramer–Douglas–Peucker polyline simplification. Keeps only the points that deviate
// from the simplified shape by more than `epsilon` px. Iterative (explicit stack) so
// long strokes cannot overflow the call stack.
export function simplifyRdp(points: Point[], epsilon: number): Point[] {
  if (points.length < 3 || epsilon <= 0) return points.slice()

  const keep = new Uint8Array(points.length)
  keep[0] = 1
  keep[points.length - 1] = 1
  const stack: Array<[number, number]> = [[0, points.length - 1]]

  while (stack.length > 0) {
    const [startIndex, endIndex] = stack.pop()!
    let maxDistance = 0
    let maxIndex = -1

    for (let index = startIndex + 1; index < endIndex; index += 1) {
      const distance = distanceToSegment(points[index], points[startIndex], points[endIndex])
      if (distance > maxDistance) {
        maxDistance = distance
        maxIndex = index
      }
    }

    if (maxIndex !== -1 && maxDistance > epsilon) {
      keep[maxIndex] = 1
      stack.push([startIndex, maxIndex], [maxIndex, endIndex])
    }
  }

  return points.filter((_, index) => keep[index] === 1)
}
