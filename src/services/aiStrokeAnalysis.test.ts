import { describe, expect, it } from 'vitest'
import { strokeMetrics } from './aiStrokeAnalysis'
import type { Issue, SegmentReport, StrokeEvaluation } from '../features/practice/utils/strokeEvaluation'

const issue = (kind: Issue['kind']): Issue => ({
  kind,
  level: 'bad',
  severity: 1.2,
  label: 'faluje',
  sentence: 'Środek linii jest zły, bo faluje wokół wzoru.',
})

const segment = (over: Partial<SegmentReport> = {}): SegmentReport => ({
  key: 'start',
  level: 'warn',
  offsetPx: 11.438712319,
  angleDeg: 9.05999,
  tremorPx: 1.14333,
  pauses: 2,
  issues: [issue('waver'), issue('tremor')],
  ...over,
})

const evaluation = (over: Partial<StrokeEvaluation> = {}): StrokeEvaluation => ({
  tooShort: false,
  score: 61.7,
  level: 'warn',
  segments: [segment()],
  lengthRatio: 0.83456,
  startGapPx: 4.2719,
  endGapPx: 18.9501,
  speedPxPerSec: 72.4,
  reversed: false,
  worstPoint: { x: 10, y: 20 },
  summary: 'Linia jest za krótka o 17%.',
  ...over,
})

describe('strokeMetrics', () => {
  it('zaokrągla liczby — model nie czyta różnicy między 11,43871 a 11,4', () => {
    const metrics = strokeMetrics(evaluation())

    expect(metrics.score).toBe(62)
    expect(metrics.lengthRatio).toBe(0.83)
    expect(metrics.startGapPx).toBe(4.3)
    expect(metrics.endGapPx).toBe(19)
    expect(metrics.speedPxPerSec).toBe(72)
    expect(metrics.segments[0].offsetPx).toBe(11.4)
    expect(metrics.segments[0].angleDeg).toBe(9.1)
    expect(metrics.segments[0].tremorPx).toBe(1.14)
  })

  // Kolejność kluczy decyduje o treści promptu, bo payload idzie przez JSON.stringify.
  // Ten sam ruch musi dawać ten sam prompt, inaczej nie da się porównać odpowiedzi.
  it('ma stałą kolejność pól', () => {
    expect(Object.keys(strokeMetrics(evaluation()))).toEqual([
      'score',
      'level',
      'lengthRatio',
      'startGapPx',
      'endGapPx',
      'speedPxPerSec',
      'reversed',
      'segments',
    ])
    expect(Object.keys(strokeMetrics(evaluation()).segments[0])).toEqual([
      'key',
      'level',
      'offsetPx',
      'angleDeg',
      'tremorPx',
      'pauses',
      'issues',
    ])
  })

  it('wysyła rodzaje błędów, a nie gotowe zdania — model pisze własny komentarz', () => {
    const metrics = strokeMetrics(evaluation())

    expect(metrics.segments[0].issues).toEqual(['waver', 'tremor'])
    expect(JSON.stringify(metrics)).not.toContain('faluje wokół wzoru')
    expect(JSON.stringify(metrics)).not.toContain('za krótka')
  })

  it('przepuszcza wszystkie trzy tercje kreski', () => {
    const metrics = strokeMetrics(
      evaluation({
        segments: [segment({ key: 'start' }), segment({ key: 'middle' }), segment({ key: 'end', issues: [] })],
      }),
    )

    expect(metrics.segments.map((s) => s.key)).toEqual(['start', 'middle', 'end'])
    expect(metrics.segments[2].issues).toEqual([])
  })
})
