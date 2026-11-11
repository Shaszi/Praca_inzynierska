import { describe, expect, it } from 'vitest'
import { WARMUPS, isWarmupId } from './warmups'
import { evaluateStroke } from './utils/strokeEvaluation'
import type { Stroke } from '../../types/drawing'

/** Idealne odrysowanie wzoru: te same punkty, tylko z czasem (ocena liczy z niego tempo). */
const trace = (reference: Stroke): Stroke => ({
  ...reference,
  points: reference.points.map((point, index) => ({ ...point, timestamp: index * 12 })),
})

describe('rozgrzewki', () => {
  it('ma unikalne id rozpoznawane przez isWarmupId', () => {
    const ids = WARMUPS.map((warmup) => warmup.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(isWarmupId(id)).toBe(true)
    // Wzorce z bazy mają uuid — nie mogą wpaść w gałąź „to rozgrzewka".
    expect(isWarmupId('3f1c9c6a-0000-4000-8000-000000000000')).toBe(false)
  })

  it('trzyma kreski w ramce płótna ćwiczenia', () => {
    for (const warmup of WARMUPS) {
      expect(warmup.strokes.length).toBeGreaterThan(1)
      for (const stroke of warmup.strokes) {
        expect(stroke.points.length).toBeGreaterThan(1)
        for (const { x, y } of stroke.points) {
          expect(x).toBeGreaterThanOrEqual(0)
          expect(x).toBeLessThanOrEqual(570)
          expect(y).toBeGreaterThanOrEqual(0)
          expect(y).toBeLessThanOrEqual(350)
        }
      }
    }
  })

  it('daje dobrą ocenę, gdy kreska pokrywa się z wzorem', () => {
    for (const warmup of WARMUPS) {
      for (const [index, reference] of warmup.strokes.entries()) {
        const result = evaluateStroke(trace(reference), reference)
        expect(result.tooShort, `${warmup.id} #${index}`).toBe(false)
        expect(result.level, `${warmup.id} #${index}`).toBe('good')
        expect(result.lengthRatio, `${warmup.id} #${index}`).toBeCloseTo(1, 1)
      }
    }
  })

  it('domyka elipsy', () => {
    const ellipses = WARMUPS.find((warmup) => warmup.id === 'warmup-ellipses')!.strokes
    for (const stroke of ellipses) {
      const first = stroke.points[0]
      const last = stroke.points[stroke.points.length - 1]
      expect(Math.hypot(last.x - first.x, last.y - first.y)).toBeLessThan(0.01)
    }
  })
})
