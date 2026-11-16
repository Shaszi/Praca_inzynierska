import type { StrokeEvaluation } from '../features/practice/utils/strokeEvaluation'
import { invokeAi } from './aiClient'

export type StrokeComment = { mistake: string; fix: string }

export type StrokeMetrics = ReturnType<typeof strokeMetrics>

const round = (value: number, places: number): number => {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

export function strokeMetrics(evaluation: StrokeEvaluation) {
  return {
    score: Math.round(evaluation.score),
    level: evaluation.level,
    lengthRatio: round(evaluation.lengthRatio, 2),
    startGapPx: round(evaluation.startGapPx, 1),
    endGapPx: round(evaluation.endGapPx, 1),
    speedPxPerSec: Math.round(evaluation.speedPxPerSec),
    reversed: evaluation.reversed,
    segments: evaluation.segments.map((segment) => ({
      key: segment.key,
      level: segment.level,
      offsetPx: round(segment.offsetPx, 1),
      angleDeg: round(segment.angleDeg, 1),
      tremorPx: round(segment.tremorPx, 2),
      pauses: segment.pauses,
      issues: segment.issues.map((issue) => issue.kind),
    })),
  }
}

export async function analyzeStroke(
  stepTitle: string,
  evaluation: StrokeEvaluation,
  signal?: AbortSignal,
): Promise<StrokeComment> {
  return invokeAi<StrokeComment>(
    { action: 'analyze-stroke', stepTitle: stepTitle.slice(0, 200), metrics: strokeMetrics(evaluation) },
    signal,
  )
}
