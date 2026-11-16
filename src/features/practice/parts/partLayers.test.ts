import { describe, expect, it } from 'vitest'
import { courseParts, partLayers } from './partLayers'

const steps = [
  { part: { id: 'jaw', name: 'Linia szczęki' } },
  { part: { id: 'eye-left', name: 'Oko — lewa strona' } },
  { part: { id: 'eye-left', name: 'Oko — lewa strona' } },
  { part: { id: 'mouth', name: 'Usta' } },
]
const stroke = (stepIndex?: number) => ({ points: [{ x: 0, y: 0, timestamp: 0 }], brushSize: 4, stepIndex })

describe('partLayers', () => {
  it('jedna warstwa na część, w kolejności kursu', () => {
    expect(courseParts(steps).map((p) => p.id)).toEqual(['jaw', 'eye-left', 'mouth'])
  })

  it('kreska trafia na warstwę części swojego kroku', () => {
    const layers = partLayers([stroke(0), stroke(1), stroke(2), stroke(3)], steps, {})
    expect(layers.map((l) => [l.id, l.strokes.length])).toEqual([
      ['jaw', 1],
      ['eye-left', 2],
      ['mouth', 1],
    ])
  })

  it('kreski bez kroku (stare projekty) mają własną warstwę, tylko gdy istnieją', () => {
    expect(partLayers([stroke(0)], steps, {}).map((l) => l.id)).not.toContain('other')
    expect(partLayers([stroke()], steps, {}).map((l) => l.id)).toContain('other')
  })

  it('ukrycie i przygaszenie części działa na jej warstwę', () => {
    const layers = partLayers([stroke(1)], steps, { 'eye-left': { visible: false, opacity: 0.4 } })
    const eye = layers.find((l) => l.id === 'eye-left')!
    expect(eye.visible).toBe(false)
    expect(eye.opacity).toBe(0.4)
  })
})
