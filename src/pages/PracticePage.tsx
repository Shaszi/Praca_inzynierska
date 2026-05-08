import { useCallback, useEffect, useMemo, useState } from 'react'
import { ControlBar } from '../components/ControlBar'
import { DebugPanel } from '../components/DebugPanel'
import { FeedbackPanel } from '../components/FeedbackPanel'
import { PracticeCanvas } from '../features/practice/components/PracticeCanvas'
import { usePracticeAnalysis } from '../features/practice/hooks/usePracticeAnalysis'
import { useReferenceGuide } from '../features/practice/hooks/useReferenceGuide'
import { ReferenceSelector } from '../features/teacher/components/ReferenceSelector'
import { useStrokes } from '../hooks/useStrokes'
import type { ReferenceDrawing, Stroke } from '../types/drawing'
import { getFeedback } from '../utils/feedback'

export function PracticePage() {
  const {
    strokes,
    strokeCount,
    currentStrokePointCount,
    lastStrokeDurationMs,
    setCurrentStrokePointCount,
    addStroke,
    undoStroke,
    redoStroke,
    clearStrokes,
    canUndo,
    canRedo,
  } = useStrokes()

  const [brushSize, setBrushSize] = useState(5)
  const [feedback, setFeedback] = useState('Draw over the guide to get feedback.')

  const {
    references: savedReferences,
    selectedReferenceId,
    setSelectedReferenceId,
    activeGuide,
    isLoadingReferences,
    errorMessage,
    refreshReferences,
  } = useReferenceGuide()

  const {
    feedbackText,
    similarityPercent,
    activeStrokeColor,
    analyzeActiveStroke,
    analyzeCompletedStroke,
    resetAnalysis,
  } = usePracticeAnalysis(activeGuide?.strokes ?? [])

  const selectedReference = useMemo<ReferenceDrawing | null>(
    () => savedReferences.find((reference) => reference.id === selectedReferenceId) ?? null,
    [savedReferences, selectedReferenceId],
  )

  const handleStrokeComplete = useCallback(
    (stroke: Stroke) => {
      addStroke(stroke)
      const shapeFeedback = getFeedback(stroke)
      const analysisResult = analyzeCompletedStroke(stroke)
      setFeedback(analysisResult?.feedback ?? shapeFeedback)
    },
    [addStroke, analyzeCompletedStroke],
  )

  const handleUndo = useCallback(() => {
    undoStroke()
    resetAnalysis()
  }, [resetAnalysis, undoStroke])

  const handleClear = useCallback(() => {
    clearStrokes()
    setFeedback('Canvas cleared. Draw over the guide to get feedback.')
    resetAnalysis()
  }, [clearStrokes, resetAnalysis])

  const handleRedo = useCallback(() => {
    redoStroke()
    resetAnalysis()
  }, [redoStroke, resetAnalysis])

  useEffect(() => {
    if (!selectedReferenceId) {
      setFeedback('Draw over the guide to get feedback.')
      return
    }

    setFeedback(feedbackText)
  }, [feedbackText, selectedReferenceId])

  useEffect(() => {
    resetAnalysis()
  }, [activeGuide?.id, resetAnalysis])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMetaOrCtrl = event.metaKey || event.ctrlKey
      if (!isMetaOrCtrl) return

      const key = event.key.toLowerCase()
      const isUndo = key === 'z' && !event.shiftKey
      const isRedo = key === 'y' || (key === 'z' && event.shiftKey)

      if (isUndo && canUndo) {
        event.preventDefault()
        handleUndo()
      }

      if (isRedo && canRedo) {
        event.preventDefault()
        handleRedo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [canRedo, canUndo, handleRedo, handleUndo])

  return (
    <section className="flex min-h-0 w-full flex-1 flex-col gap-4">
      <ControlBar
        brushSize={brushSize}
        onBrushSizeChange={setBrushSize}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onClear={handleClear}
        canUndo={canUndo}
        canRedo={canRedo}
        extraControls={
          <>
            <button
              type="button"
              onClick={refreshReferences}
              disabled={isLoadingReferences}
              className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoadingReferences ? 'Loading...' : 'Reload References'}
            </button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-300 bg-white p-3 shadow-sm">
        <p className="text-sm text-slate-600">
          Guide:{' '}
          <span className="font-semibold text-slate-900">
            {selectedReference ? selectedReference.name : 'No guide loaded'}
          </span>
        </p>
        <ReferenceSelector
          references={savedReferences}
          selectedId={selectedReference ? selectedReferenceId : ''}
          onSelect={setSelectedReferenceId}
          label="Reference"
          emptyOptionLabel="No reference"
        />
        {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}
      </div>

      <div className="min-h-0 flex-1">
        <PracticeCanvas
          userStrokes={strokes}
          referenceStrokes={activeGuide?.strokes ?? []}
          brushSize={brushSize}
          userStrokeColor={activeStrokeColor}
          onStrokeComplete={handleStrokeComplete}
          onCurrentStrokePointCountChange={setCurrentStrokePointCount}
          onActiveStrokeChange={analyzeActiveStroke}
        />
      </div>

      <DebugPanel
        strokeCount={strokeCount}
        currentStrokePointCount={currentStrokePointCount}
        lastStrokeDurationMs={lastStrokeDurationMs}
      />

      <FeedbackPanel feedback={feedback} similarity={similarityPercent} />
    </section>
  )
}
