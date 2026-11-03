import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Point, Stroke } from '../../../types/drawing'
import { evaluateStroke, liveAccuracy, type StrokeEvaluation } from '../utils/strokeEvaluation'

type UsePracticeAnalysisResult = {
  evaluation: StrokeEvaluation | null
  activeStrokeColor: string
  analyzeActiveStroke: (stroke: Stroke | null) => void
  evaluateCompletedStroke: (stroke: Stroke, rawPoints: Point[]) => StrokeEvaluation | null
  resetAnalysis: () => void
}

const INK = '#16181d'

export function usePracticeAnalysis(referenceStroke: Stroke | null): UsePracticeAnalysisResult {
  const [liveScore, setLiveScore] = useState<number | null>(null)
  const [evaluation, setEvaluation] = useState<StrokeEvaluation | null>(null)
  const rafRef = useRef<number | null>(null)

  // W trakcie rysowania liczymy tylko odległość od wzoru — co klatkę, bez blokowania rysowania.
  const analyzeActiveStroke = useCallback(
    (stroke: Stroke | null) => {
      if (!stroke || !referenceStroke) {
        setLiveScore(null)
        return
      }
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        setLiveScore(liveAccuracy(stroke, referenceStroke))
      })
    },
    [referenceStroke],
  )

  const evaluateCompletedStroke = useCallback(
    (stroke: Stroke, rawPoints: Point[]) => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      setLiveScore(null)
      if (!referenceStroke) return null
      const result = evaluateStroke(stroke, referenceStroke, rawPoints)
      setEvaluation(result)
      return result
    },
    [referenceStroke],
  )

  const resetAnalysis = useCallback(() => {
    setLiveScore(null)
    setEvaluation(null)
  }, [])

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const activeStrokeColor = useMemo(() => {
    if (liveScore === null) return INK
    if (liveScore >= 80) return '#17703f'
    if (liveScore >= 55) return '#b86200'
    return '#b42318'
  }, [liveScore])

  return { evaluation, activeStrokeColor, analyzeActiveStroke, evaluateCompletedStroke, resetAnalysis }
}
