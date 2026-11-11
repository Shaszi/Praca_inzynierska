// One Euro Filter — G. Casiez, N. Roussel, D. Vogel, "1€ Filter: A Simple Speed-based
// Low-pass Filter for Noisy Input in Interactive Systems", CHI 2012.
//
// Adaptive low-pass filter: the cutoff frequency grows with movement speed, so slow
// movement is smoothed strongly (removes hand tremor) while fast movement is smoothed
// weakly (keeps lag low). This variant filters a 2D point and uses the speed magnitude
// so both axes share the same cutoff and the stroke shape is not distorted.

export type OneEuroParams = {
  minCutoff: number // Hz — smoothing at rest; lower = smoother
  beta: number // speed coefficient; higher = less lag when moving fast
  derivativeCutoff: number // Hz — smoothing of the speed estimate itself
}

const DEFAULT_DT = 1 / 120

function smoothingFactor(cutoffHz: number, dtSeconds: number): number {
  const tau = 1 / (2 * Math.PI * cutoffHz)
  return 1 / (1 + tau / dtSeconds)
}

export class OneEuroFilter2D {
  private prevX = 0
  private prevY = 0
  private prevSpeed = 0
  private prevTime = 0
  private initialized = false
  private readonly params: OneEuroParams

  constructor(params: OneEuroParams) {
    this.params = params
  }

  filter(x: number, y: number, timeSeconds: number): { x: number; y: number } {
    if (!this.initialized) {
      this.initialized = true
      this.prevX = x
      this.prevY = y
      this.prevTime = timeSeconds
      return { x, y }
    }

    // Coalesced events can share a timestamp — fall back to a typical input rate
    const dt = timeSeconds > this.prevTime ? timeSeconds - this.prevTime : DEFAULT_DT

    const rawSpeed = Math.hypot(x - this.prevX, y - this.prevY) / dt
    const speedAlpha = smoothingFactor(this.params.derivativeCutoff, dt)
    const speed = this.prevSpeed + speedAlpha * (rawSpeed - this.prevSpeed)

    const cutoff = this.params.minCutoff + this.params.beta * speed
    const alpha = smoothingFactor(cutoff, dt)
    const filteredX = this.prevX + alpha * (x - this.prevX)
    const filteredY = this.prevY + alpha * (y - this.prevY)

    this.prevX = filteredX
    this.prevY = filteredY
    this.prevSpeed = speed
    this.prevTime = timeSeconds
    return { x: filteredX, y: filteredY }
  }
}
