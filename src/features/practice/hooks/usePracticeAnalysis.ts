import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Point, Stroke } from '../../../types/drawing'
import { useCanvasColors } from '../../canvas/utils/themeColors'
import { evaluateStroke, liveProgress, type LiveProgress, type StrokeEvaluation } from '../utils/strokeEvaluation'

type UsePracticeAnalysisResult = {
  evaluation: StrokeEvaluation | null
  live: LiveProgress | null
  activeStrokeColor: string
  analyzeActiveStroke: (stroke: Stroke | null) => void
  evaluateCompletedStroke: (stroke: Stroke, rawPoints: Point[]) => StrokeEvaluation | null
  resetAnalysis: () => void
}

export function usePracticeAnalysis(referenceStroke: Stroke | null): UsePracticeAnalysisResult {
  // Kolory kreski czytane z tokenów, nie wpisane na sztywno — dzięki temu jadą za motywem.
  const colors = useCanvasColors()
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

  const activeStrokeColor = useMemo(() => {
    if (live === null) return colors.ink
    if (live.accuracy >= 80) return colors.success
    if (live.accuracy >= 55) return colors.warn
    return colors.danger
  }, [colors, live])

  return { evaluation, live, activeStrokeColor, analyzeActiveStroke, evaluateCompletedStroke, resetAnalysis }
}
