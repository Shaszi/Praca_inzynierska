import { useCallback, useMemo, useState } from 'react'
import type { Stroke } from '../types/drawing'
import { cloneStrokes } from '../utils/strokes'

type UseStrokesResult = {
  strokes: Stroke[]
  strokeCount: number
  currentStrokePointCount: number
  lastStrokeDurationMs: number | null
  setCurrentStrokePointCount: (count: number) => void
  replaceStrokes: (nextStrokes: Stroke[]) => void
  transformStrokes: (transformer: (previous: Stroke[]) => Stroke[]) => void
  addStroke: (stroke: Stroke) => void
  undoStroke: () => void
  clearStrokes: () => void
}

function calculateDuration(stroke: Stroke): number {
  if (stroke.points.length < 2) {
    return 0
  }

  const firstTimestamp = stroke.points[0].timestamp
  const lastTimestamp = stroke.points[stroke.points.length - 1].timestamp
  return Math.max(0, lastTimestamp - firstTimestamp)
}

export function useStrokes(initialStrokes: Stroke[] = []): UseStrokesResult {
  const [strokes, setStrokes] = useState<Stroke[]>(() => cloneStrokes(initialStrokes))
  const [currentStrokePointCount, setCurrentStrokePointCount] = useState(0)
  const [lastStrokeDurationMs, setLastStrokeDurationMs] = useState<number | null>(null)

  const replaceStrokes = useCallback((nextStrokes: Stroke[]) => {
    setStrokes(cloneStrokes(nextStrokes))
    setCurrentStrokePointCount(0)
    setLastStrokeDurationMs(null)
  }, [])

  const transformStrokes = useCallback((transformer: (previous: Stroke[]) => Stroke[]) => {
    setStrokes((previousStrokes) => cloneStrokes(transformer(previousStrokes)))
  }, [])

  const addStroke = useCallback((stroke: Stroke) => {
    const nextStroke: Stroke = {
      brushSize: stroke.brushSize,
      points: stroke.points.map((point) => ({ ...point })),
    }

    setStrokes((previousStrokes) => [...previousStrokes, nextStroke])
    setLastStrokeDurationMs(calculateDuration(nextStroke))
    setCurrentStrokePointCount(0)
  }, [])

  const undoStroke = useCallback(() => {
    setStrokes((previousStrokes) => previousStrokes.slice(0, -1))
  }, [])

  const clearStrokes = useCallback(() => {
    setStrokes([])
    setCurrentStrokePointCount(0)
    setLastStrokeDurationMs(null)
  }, [])

  const strokeCount = useMemo(() => strokes.length, [strokes])

  return {
    strokes,
    strokeCount,
    currentStrokePointCount,
    lastStrokeDurationMs,
    setCurrentStrokePointCount,
    replaceStrokes,
    transformStrokes,
    addStroke,
    undoStroke,
    clearStrokes,
  }
}