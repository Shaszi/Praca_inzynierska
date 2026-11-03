import type { Point, SmoothingSettings } from '../../../types/drawing'
import { OneEuroFilter2D } from './oneEuroFilter'

// Real-time stabilizer: transforms raw pointer samples into the points that are drawn
// while the stroke is in progress.
export interface Stabilizer {
  // Returns the stabilized point, or null when the brush should not move
  push(raw: Point): Point | null
  // Called on pointer up; returns a final point the stroke should be extended to, if any
  finish(): Point | null
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t
}

class PassthroughStabilizer implements Stabilizer {
  push(raw: Point): Point {
    return raw
  }

  finish(): null {
    return null
  }
}

class AdaptiveStabilizer implements Stabilizer {
  private readonly filter: OneEuroFilter2D

  constructor(strength: number) {
    this.filter = new OneEuroFilter2D({
      minCutoff: lerp(3, 0.3, strength),
      beta: lerp(0.02, 0.002, strength),
      derivativeCutoff: 1,
    })
  }

  push(raw: Point): Point {
    const { x, y } = this.filter.filter(raw.x, raw.y, raw.timestamp / 1000)
    return { x, y, timestamp: raw.timestamp }
  }

  // The filter lags only slightly; snapping to the raw end point would reintroduce
  // the "hook" that often appears when the pen is lifted.
  finish(): null {
    return null
  }
}

// "Pulled string" / lazy brush: the brush hangs on a string of fixed length behind the
// cursor and moves only when the string is taut. Small tremors inside the radius are
// ignored entirely, which gives very clean, deliberate lines.
class RopeStabilizer implements Stabilizer {
  private brush: Point | null = null
  private lastRaw: Point | null = null
  private readonly length: number

  constructor(strength: number) {
    this.length = lerp(2, 40, strength)
  }

  push(raw: Point): Point | null {
    this.lastRaw = raw
    if (!this.brush) {
      this.brush = raw
      return raw
    }

    const dx = raw.x - this.brush.x
    const dy = raw.y - this.brush.y
    const distance = Math.hypot(dx, dy)
    if (distance <= this.length) return null

    const pull = (distance - this.length) / distance
    this.brush = {
      x: this.brush.x + dx * pull,
      y: this.brush.y + dy * pull,
      timestamp: raw.timestamp,
    }
    return this.brush
  }

  // Without this the stroke would end up to `length` px short of where the pen was lifted
  finish(): Point | null {
    return this.lastRaw
  }
}

export function createStabilizer(settings: SmoothingSettings): Stabilizer {
  const strength = Math.min(Math.max(settings.strength, 0), 100) / 100
  if (settings.mode === 'off' || strength === 0) return new PassthroughStabilizer()
  if (settings.mode === 'rope') return new RopeStabilizer(strength)
  return new AdaptiveStabilizer(strength)
}
