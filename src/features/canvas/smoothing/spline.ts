import type { Point } from '../../../types/drawing'

// Centripetal parameterization (alpha = 0.5) avoids cusps and self-intersections
// that uniform Catmull-Rom produces on unevenly spaced control points.
const ALPHA = 0.5
const MIN_KNOT_GAP = 1e-4

type Vec2 = { x: number; y: number }

function knot(previous: number, a: Vec2, b: Vec2): number {
  return previous + Math.max(Math.hypot(b.x - a.x, b.y - a.y) ** ALPHA, MIN_KNOT_GAP)
}

function mix(a: Vec2, b: Vec2, ta: number, tb: number, t: number): Vec2 {
  const wa = (tb - t) / (tb - ta)
  const wb = (t - ta) / (tb - ta)
  return { x: wa * a.x + wb * b.x, y: wa * a.y + wb * b.y }
}

// Evaluates the segment between p1 and p2 at local parameter u ∈ [0, 1]
// (Barry–Goldman pyramidal formulation).
function evaluateSegment(p0: Point, p1: Point, p2: Point, p3: Point, u: number): Point {
  const t0 = 0
  const t1 = knot(t0, p0, p1)
  const t2 = knot(t1, p1, p2)
  const t3 = knot(t2, p2, p3)
  const t = t1 + (t2 - t1) * u

  const a1 = mix(p0, p1, t0, t1, t)
  const a2 = mix(p1, p2, t1, t2, t)
  const a3 = mix(p2, p3, t2, t3, t)
  const b1 = mix(a1, a2, t0, t2, t)
  const b2 = mix(a2, a3, t1, t3, t)
  const c = mix(b1, b2, t1, t2, t)

  return {
    x: c.x,
    y: c.y,
    timestamp: p1.timestamp + (p2.timestamp - p1.timestamp) * u,
  }
}

function reflect(anchor: Point, neighbour: Point): Point {
  return {
    x: 2 * anchor.x - neighbour.x,
    y: 2 * anchor.y - neighbour.y,
    timestamp: anchor.timestamp,
  }
}

// Interpolating spline through all control points, sampled roughly every `spacing` px.
// Unlike midpoint/Bezier smoothing, the curve passes exactly through each control point.
export function resampleCatmullRom(points: Point[], spacing: number): Point[] {
  if (points.length < 3) return points.slice()

  const result: Point[] = [{ ...points[0] }]
  const last = points.length - 1

  for (let index = 0; index < last; index += 1) {
    const p0 = index === 0 ? reflect(points[0], points[1]) : points[index - 1]
    const p1 = points[index]
    const p2 = points[index + 1]
    const p3 = index + 1 === last ? reflect(points[last], points[last - 1]) : points[index + 2]

    const steps = Math.max(1, Math.ceil(Math.hypot(p2.x - p1.x, p2.y - p1.y) / spacing))
    for (let step = 1; step <= steps; step += 1) {
      result.push(evaluateSegment(p0, p1, p2, p3, step / steps))
    }
  }

  return result
}
