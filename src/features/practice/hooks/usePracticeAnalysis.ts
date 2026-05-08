import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Stroke } from '../../../types/drawing'
import {
  calculateStrokeSimilarity,
  type StrokeSimilarityResult,
} from '../utils/strokeAnalysis'

const DEFAULT_FEEDBACK = 'Draw over the guide to get feedback.'

type UsePracticeAnalysisResult = {
  liveResult: StrokeSimilarityResult | null
  lastResult: StrokeSimilarityResult | null
  feedbackText: string
  similarityPercent: number | null
  activeStrokeColor: string
  analyzeActiveStroke: (stroke: Stroke | null) => void
  analyzeCompletedStroke: (stroke: Stroke) => StrokeSimilarityResult | null
  resetAnalysis: () => void
}

function pickBestReferenceMatch(
  stroke: Stroke,
  referenceStrokes: Stroke[],
): StrokeSimilarityResult | null {
  if (referenceStrokes.length === 0) {
    return null
  }

  let bestMatch: StrokeSimilarityResult | null = null
  for (const referenceStroke of referenceStrokes) {
    const similarity = calculateStrokeSimilarity(stroke, referenceStroke)
    if (!bestMatch || similarity.averageDistance < bestMatch.averageDistance) {
      bestMatch = similarity
    }
  }

  return bestMatch
}

export function usePracticeAnalysis(referenceStrokes: Stroke[]): UsePracticeAnalysisResult {
  const [liveResult, setLiveResult] = useState<StrokeSimilarityResult | null>(null)
  const [lastResult, setLastResult] = useState<StrokeSimilarityResult | null>(null)
  const rafRef = useRef<number | null>(null)

  const runAnalysis = useCallback(
    (stroke: Stroke) => pickBestReferenceMatch(stroke, referenceStrokes),
    [referenceStrokes],
  )

  const analyzeActiveStroke = useCallback(
    (stroke: Stroke | null) => {
      if (!stroke || stroke.points.length < 2 || referenceStrokes.length === 0) {
        setLiveResult(null)
        return
      }

      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }

      rafRef.current = requestAnimationFrame(() => {
        setLiveResult(runAnalysis(stroke))
      })
    },
    [referenceStrokes.length, runAnalysis],
  )

  const analyzeCompletedStroke = useCallback(
    (stroke: Stroke) => {
      const result = runAnalysis(stroke)
      setLastResult(result)
      setLiveResult(null)
      return result
    },
    [runAnalysis],
  )

  const resetAnalysis = useCallback(() => {
    setLiveResult(null)
    setLastResult(null)
  }, [])

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [])

  const activeResult = liveResult ?? lastResult
  const feedbackText = activeResult?.feedback ?? DEFAULT_FEEDBACK
  const similarityPercent = activeResult ? activeResult.score / 100 : null

  const activeStrokeColor = useMemo(() => {
    if (!liveResult) return '#1f2937'
    if (liveResult.score >= 80) return '#15803d'
    if (liveResult.score >= 60) return '#ca8a04'
    return '#b91c1c'
  }, [liveResult])

  return {
    liveResult,
    lastResult,
    feedbackText,
    similarityPercent,
    activeStrokeColor,
    analyzeActiveStroke,
    analyzeCompletedStroke,
    resetAnalysis,
  }
}
