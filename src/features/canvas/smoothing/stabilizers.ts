import type { Point, SmoothingSettings } from '../../../types/drawing'
import { OneEuroFilter2D } from './oneEuroFilter'

export interface Stabilizer {
  push(raw: Point): Point | null
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

  finish(): null {
    return null
  }
}

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
