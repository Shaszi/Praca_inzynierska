import type { Point, SmoothingSettings } from '../../../types/drawing'
import { simplifyRdp } from './simplify'
import { resampleCatmullRom } from './spline'

export { createStabilizer, type Stabilizer } from './stabilizers'
export { OneEuroFilter2D } from './oneEuroFilter'
export { simplifyRdp } from './simplify'
export { resampleCatmullRom } from './spline'

export const DEFAULT_SMOOTHING: SmoothingSettings = { mode: 'adaptive', strength: 50 }

// Distance between stored stroke points, in px
export const POINT_SPACING_PX = 3

// Post-processing applied once the stroke is finished:
//   1. Ramer–Douglas–Peucker removes residual jitter (points within `epsilon` of the shape)
//   2. centripetal Catmull-Rom rebuilds a smooth curve through the remaining points
//   3. the curve is resampled at a uniform spacing, so analysis gets evenly spaced data
export function refineStroke(points: Point[], settings: SmoothingSettings): Point[] {
  if (settings.mode === 'off' || settings.strength <= 0 || points.length < 3) return points

  const strength = Math.min(settings.strength, 100) / 100
  const epsilon = 0.3 + 1.7 * strength
  return resampleCatmullRom(simplifyRdp(points, epsilon), POINT_SPACING_PX)
}
