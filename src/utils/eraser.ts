import type { Point, Stroke } from '../types/drawing'

function distanceBetweenPoints(a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  return Math.sqrt(dx * dx + dy * dy)
}

export function erasePointsFromStrokes(
  strokes: Stroke[],
  cursorPoint: Point,
  radius: number,
): Stroke[] {
  if (radius <= 0 || strokes.length === 0) {
    return strokes
  }

  const nextStrokes: Stroke[] = []

  for (const stroke of strokes) {
    let currentSegment: Point[] = []

    for (const point of stroke.points) {
      const shouldErase = distanceBetweenPoints(point, cursorPoint) <= radius

      if (shouldErase) {
        if (currentSegment.length > 0) {
          nextStrokes.push({
            brushSize: stroke.brushSize,
            points: currentSegment,
          })
          currentSegment = []
        }

        continue
      }

      currentSegment.push({ ...point })
    }

    if (currentSegment.length > 0) {
      nextStrokes.push({
        brushSize: stroke.brushSize,
        points: currentSegment,
      })
    }
  }

  return nextStrokes
}