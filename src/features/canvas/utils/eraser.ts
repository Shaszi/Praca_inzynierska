import type { Point, Stroke } from '../../../types/drawing'

function getDistance(a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  return Math.sqrt(dx * dx + dy * dy)
}

// Pure eraser utility: remove points by radius and split strokes when gaps appear.
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
    let segment: Point[] = []

    for (const point of stroke.points) {
      if (getDistance(point, cursorPoint) <= radius) {
        if (segment.length > 0) {
          nextStrokes.push({ brushSize: stroke.brushSize, points: segment })
          segment = []
        }
        continue
      }

      segment.push({ ...point })
    }

    if (segment.length > 0) {
      nextStrokes.push({ brushSize: stroke.brushSize, points: segment })
    }
  }

  return nextStrokes
}