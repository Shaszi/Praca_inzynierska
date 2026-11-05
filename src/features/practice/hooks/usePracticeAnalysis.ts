import { useCallback, useEffect, useRef, useState } from 'react'
import type { Point, Stroke } from '../../../types/drawing'
import { evaluateStroke, liveProgress, type LiveProgress, type StrokeEvaluation } from '../utils/strokeEvaluation'

type UsePracticeAnalysisResult = {
  evaluation: StrokeEvaluation | null
  live: LiveProgress | null
  analyzeActiveStroke: (stroke: Stroke | null) => void
  evaluateCompletedStroke: (stroke: Stroke, rawPoints: Point[]) => StrokeEvaluation | null
  resetAnalysis: () => void
}

export function usePracticeAnalysis(referenceStroke: Stroke | null): UsePracticeAnalysisResult {
  const [live, setLive] = useState<LiveProgress | null>(null)
  const [evaluation, setEvaluation] = useState<StrokeEvaluation | null>(null)
  const rafRef = useRef<number | null>(null)

  // W trakcie rysowania liczymy tylko odległość od wzoru — co klatkę, bez blokowania rysowania.
  const analyzeActiveStroke = useCallback(
    (stroke: Stroke | null) => {
      if (!stroke || !referenceStroke) {
        setLive(null)
        return
      }
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        setLive(liveProgress(stroke, referenceStroke))
      })
    },
    [referenceStroke],
  )

  const evaluateCompletedStroke = useCallback(
    (stroke: Stroke, rawPoints: Point[]) => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      setLive(null)
      if (!referenceStroke) return null
      const result = evaluateStroke(stroke, referenceStroke, rawPoints)
      setEvaluation(result)
      return result
    },
    [referenceStroke],
  )

  const resetAnalysis = useCallback(() => {
    setLive(null)
    setEvaluation(null)
  }, [])

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [])


  return { evaluation, live, analyzeActiveStroke, evaluateCompletedStroke, resetAnalysis }
}
