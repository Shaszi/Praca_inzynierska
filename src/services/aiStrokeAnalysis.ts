import type { StrokeEvaluation } from '../features/practice/utils/strokeEvaluation'
import { invokeAi } from './aiClient'

/**
 * Komentarz modelu do jednej kreski w trybie z wzorcem.
 *
 * Model nie dostaje obrazka: algorytm (`strokeEvaluation.ts`) policzył już odchylenie,
 * kąt, drżenie i tempo, więc wysyłamy gotowe liczby. Jest to tańsze od miniatury
 * i trafniejsze, bo model niczego nie zgaduje — opisuje pomiary słowami.
 */
export type StrokeComment = { mistake: string; fix: string }

export type StrokeMetrics = ReturnType<typeof strokeMetrics>

const round = (value: number, places: number): number => {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

/**
 * Pomiary w formie wysyłanej do modelu. Liczby są zaokrąglone, bo „11.43871231952" i „11.4"
 * znaczą dla modelu to samo, a kolejność pól jest stała — wtedy ten sam ruch daje ten sam
 * prompt. Pola `summary`, `issues[].sentence` i `worstPoint` zostają na kliencie: model ma
 * napisać własny komentarz, nie przeredagować gotowy.
 */
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

/** Rzuca `AiError` — błąd nie może udawać komentarza, bo trafiłby do bazy jako ocena. */
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
