import { useCallback, useMemo, useState } from 'react'
import { useHistory } from './useHistory'
import type { Stroke } from '../types/drawing'
import { cloneStrokes } from '../utils/strokes'

type UseStrokesResult = {
  strokes: Stroke[]
  strokeCount: number
  currentStrokePointCount: number
  lastStrokeDurationMs: number | null
  setCurrentStrokePointCount: (count: number) => void
  replaceStrokes: (nextStrokes: Stroke[]) => void
  beginEraseSession: () => void
  eraseInSession: (transformer: (previous: Stroke[]) => Stroke[]) => void
  endEraseSession: () => void
  addStroke: (stroke: Stroke) => void
  undoStroke: () => void
  redoStroke: () => void
  clearStrokes: () => void
  canUndo: boolean
  canRedo: boolean
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
  const { state, set, undo, redo, canUndo, canRedo } = useHistory<Stroke[]>(
    cloneStrokes(initialStrokes),
    { clone: cloneStrokes, maxHistory: 50 },
  )
  const [erasePreviewStrokes, setErasePreviewStrokes] = useState<Stroke[] | null>(null)
  const strokes = erasePreviewStrokes ?? state.present
  const [currentStrokePointCount, setCurrentStrokePointCount] = useState(0)
  const [lastStrokeDurationMs, setLastStrokeDurationMs] = useState<number | null>(null)

  const replaceStrokes = useCallback((nextStrokes: Stroke[]) => {
    set(nextStrokes)
    setErasePreviewStrokes(null)
    setCurrentStrokePointCount(0)
    setLastStrokeDurationMs(null)
  }, [set])

  const beginEraseSession = useCallback(() => {
    setErasePreviewStrokes((current) => current ?? cloneStrokes(state.present))
  }, [state.present])

  const eraseInSession = useCallback((transformer: (previous: Stroke[]) => Stroke[]) => {
    setErasePreviewStrokes((previous) => {
      const source = previous ?? cloneStrokes(state.present)
      return cloneStrokes(transformer(source))
    })
  }, [state.present])

  const endEraseSession = useCallback(() => {
    if (!erasePreviewStrokes) return
    set(erasePreviewStrokes)
    setErasePreviewStrokes(null)
    setCurrentStrokePointCount(0)
    setLastStrokeDurationMs(null)
  }, [erasePreviewStrokes, set])

  const addStroke = useCallback((stroke: Stroke) => {
    const nextStroke: Stroke = {
      brushSize: stroke.brushSize,
      points: stroke.points.map((point) => ({ ...point })),
    }

    set([...strokes, nextStroke])
    setLastStrokeDurationMs(calculateDuration(nextStroke))
    setCurrentStrokePointCount(0)
  }, [set, strokes])

  const undoStroke = useCallback(() => {
    setErasePreviewStrokes(null)
    undo()
  }, [undo])

  const redoStroke = useCallback(() => {
    setErasePreviewStrokes(null)
    redo()
  }, [redo])

  const clearStrokes = useCallback(() => {
    set([])
    setErasePreviewStrokes(null)
    setCurrentStrokePointCount(0)
    setLastStrokeDurationMs(null)
  }, [set])

  const strokeCount = useMemo(() => strokes.length, [strokes])

  return {
    strokes,
    strokeCount,
    currentStrokePointCount,
    lastStrokeDurationMs,
    setCurrentStrokePointCount,
    replaceStrokes,
    beginEraseSession,
    eraseInSession,
    endEraseSession,
    addStroke,
    undoStroke,
    redoStroke,
    clearStrokes,
    canUndo,
    canRedo,
  }
}
