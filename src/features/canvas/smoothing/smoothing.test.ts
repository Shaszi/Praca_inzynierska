import { describe, expect, it } from 'vitest'
import type { Point } from '../../../types/drawing'
import { createStabilizer, refineStroke, resampleCatmullRom, simplifyRdp } from './index'

const FRAME_MS = 1000 / 120

// Deterministic pseudo-random noise so tests are reproducible
function noise(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return (x - Math.floor(x)) * 2 - 1
}

function noisyHorizontalLine(count: number, amplitude: number): Point[] {
  return Array.from({ length: count }, (_, i) => ({
    x: i * 4,
    y: 100 + noise(i + 1) * amplitude,
    timestamp: i * FRAME_MS,
  }))
}

function deviationFromLine(points: Point[], y: number): number {
  return Math.sqrt(points.reduce((sum, p) => sum + (p.y - y) ** 2, 0) / points.length)
}

describe('simplifyRdp', () => {
  it('collapses collinear points to the end points', () => {
    const line = Array.from({ length: 50 }, (_, i) => ({ x: i, y: i * 2, timestamp: i }))
    const simplified = simplifyRdp(line, 0.5)
    expect(simplified).toEqual([line[0], line[49]])
  })

  it('keeps corners that exceed the tolerance', () => {
    const corner: Point[] = [
      { x: 0, y: 0, timestamp: 0 },
      { x: 50, y: 0, timestamp: 1 },
      { x: 100, y: 0, timestamp: 2 },
      { x: 100, y: 50, timestamp: 3 },
      { x: 100, y: 100, timestamp: 4 },
    ]
    expect(simplifyRdp(corner, 1).map((p) => [p.x, p.y])).toEqual([[0, 0], [100, 0], [100, 100]])
  })

  it('keeps the shape of a closed loop', () => {
    const loop = Array.from({ length: 41 }, (_, i) => {
      const angle = (i / 40) * Math.PI * 2
      return { x: Math.cos(angle) * 50, y: Math.sin(angle) * 50, timestamp: i }
    })
    expect(simplifyRdp(loop, 1).length).toBeGreaterThan(4)
  })
})

describe('resampleCatmullRom', () => {
  const controlPoints: Point[] = [
    { x: 0, y: 0, timestamp: 0 },
    { x: 60, y: 40, timestamp: 100 },
    { x: 120, y: 0, timestamp: 200 },
    { x: 180, y: 40, timestamp: 300 },
  ]

  it('passes through every control point', () => {
    const curve = resampleCatmullRom(controlPoints, 3)
    for (const control of controlPoints) {
      const nearest = Math.min(...curve.map((p) => Math.hypot(p.x - control.x, p.y - control.y)))
      expect(nearest).toBeLessThan(1e-6)
    }
  })

  it('samples at roughly the requested spacing', () => {
    const curve = resampleCatmullRom(controlPoints, 3)
    for (let i = 1; i < curve.length; i += 1) {
      const gap = Math.hypot(curve[i].x - curve[i - 1].x, curve[i].y - curve[i - 1].y)
      expect(gap).toBeLessThan(6)
    }
  })

  it('interpolates timestamps monotonically', () => {
    const curve = resampleCatmullRom(controlPoints, 3)
    for (let i = 1; i < curve.length; i += 1) {
      expect(curve[i].timestamp).toBeGreaterThanOrEqual(curve[i - 1].timestamp)
    }
  })
})

describe('stabilizers', () => {
  it('adaptive mode reduces jitter on a shaky straight line', () => {
    const raw = noisyHorizontalLine(200, 3)
    const stabilizer = createStabilizer({ mode: 'adaptive', strength: 70 })
    const filtered = raw.map((p) => stabilizer.push(p)).filter((p): p is Point => p !== null)

    expect(deviationFromLine(filtered, 100)).toBeLessThan(deviationFromLine(raw, 100) * 0.6)
  })

  it('rope mode keeps the brush within the rope length and catches up on finish', () => {
    const stabilizer = createStabilizer({ mode: 'rope', strength: 50 })
    const raw = noisyHorizontalLine(100, 2)
    let brush: Point | null = null

    for (const point of raw) {
      brush = stabilizer.push(point) ?? brush
      expect(Math.hypot(point.x - brush!.x, point.y - brush!.y)).toBeLessThanOrEqual(21 + 1e-9)
    }

    expect(stabilizer.finish()).toEqual(raw[raw.length - 1])
  })

  it('rope mode ignores tremor smaller than the rope length', () => {
    const stabilizer = createStabilizer({ mode: 'rope', strength: 100 })
    stabilizer.push({ x: 0, y: 0, timestamp: 0 })
    for (let i = 1; i < 50; i += 1) {
      expect(stabilizer.push({ x: noise(i) * 5, y: noise(i + 100) * 5, timestamp: i * FRAME_MS })).toBeNull()
    }
  })

  it('off mode passes points through unchanged', () => {
    const stabilizer = createStabilizer({ mode: 'off', strength: 100 })
    const point = { x: 12.5, y: 7, timestamp: 3 }
    expect(stabilizer.push(point)).toEqual(point)
    expect(stabilizer.finish()).toBeNull()
  })
})

describe('refineStroke', () => {
  it('keeps start and end points of the stroke', () => {
    const raw = noisyHorizontalLine(100, 1)
    const refined = refineStroke(raw, { mode: 'adaptive', strength: 50 })
    expect(refined[0]).toEqual(raw[0])
    expect(refined[refined.length - 1].x).toBeCloseTo(raw[raw.length - 1].x)
    expect(refined[refined.length - 1].y).toBeCloseTo(raw[raw.length - 1].y)
  })

  it('does nothing when smoothing is off', () => {
    const raw = noisyHorizontalLine(20, 3)
    expect(refineStroke(raw, { mode: 'off', strength: 100 })).toBe(raw)
  })
})
