import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Point, Stroke } from '../../../types/drawing'
import {
  combineStepStrokes,
  evaluateStroke,
  liveProgress,
  type LiveProgress,
  type StrokeEvaluation,
} from '../utils/strokeEvaluation'

type Raws = Record<number, Point[]>

const rawKey = (stroke: Stroke) => stroke.points[0]?.timestamp ?? -1

/** Ocena całego kroku: wszystkie jego kreski razem, nie ostatnia z osobna. */
export function evaluateStep(reference: Stroke, stepStrokes: Stroke[], raws: Raws): { evaluation: StrokeEvaluation; stroke: Stroke } {
  const combined = combineStepStrokes(
    stepStrokes.map((stroke) => ({ stroke, raw: raws[rawKey(stroke)] })),
    reference,
  )
  return { evaluation: evaluateStroke(combined.stroke, reference, combined.raw), stroke: combined.stroke }
}

/**
 * Analiza kroku liczona z kresek, które w nim leżą na płótnie. Cofnięcie, gumka czy powrót
 * do projektu zmieniają kreski, więc ocena i pasek pokrycia same idą za nimi.
 */
export function usePracticeAnalysis(referenceStroke: Stroke | null, stepStrokes: Stroke[]) {
  const [live, setLive] = useState<LiveProgress | null>(null)
  const [raws, setRaws] = useState<Raws>({})
  const rafRef = useRef<number | null>(null)

  const evaluation = useMemo(
    () => (referenceStroke && stepStrokes.length > 0 ? evaluateStep(referenceStroke, stepStrokes, raws).evaluation : null),
    [raws, referenceStroke, stepStrokes],
  )
  const stepProgress = useMemo(
    () => (referenceStroke && stepStrokes.length > 0 ? liveProgress(stepStrokes, referenceStroke) : null),
    [referenceStroke, stepStrokes],
  )

  const analyzeActiveStroke = useCallback(
    (stroke: Stroke | null) => {
      if (!stroke || !referenceStroke) {
        setLive(null)
        return
      }
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        setLive(liveProgress([...stepStrokes, stroke], referenceStroke))
      })
    },
    [referenceStroke, stepStrokes],
  )

  /** Ocena kroku po dołożeniu `stroke` — od razu, zanim kreska trafi do stanu płótna. */
  const evaluateWithStroke = useCallback(
    (stroke: Stroke, rawPoints: Point[]) => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      setLive(null)
      if (!referenceStroke) return null
      const nextRaws = { ...raws, [rawKey(stroke)]: rawPoints }
      setRaws(nextRaws)
      return evaluateStep(referenceStroke, [...stepStrokes, stroke], nextRaws)
    },
    [raws, referenceStroke, stepStrokes],
  )

  const resetLive = useCallback(() => setLive(null), [])

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return { evaluation, live, stepProgress, analyzeActiveStroke, evaluateWithStroke, resetLive }
}
