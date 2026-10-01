import { useCallback, useEffect, useMemo, useState } from 'react'
import { ControlBar } from '../components/ControlBar'
import { DebugPanel } from '../components/DebugPanel'
import { FeedbackPanel } from '../components/FeedbackPanel'
import { PracticeCanvas } from '../features/practice/components/PracticeCanvas'
import { usePracticeAnalysis } from '../features/practice/hooks/usePracticeAnalysis'
import { useReferenceGuide } from '../features/practice/hooks/useReferenceGuide'
import { ReferenceSelector } from '../features/teacher/components/ReferenceSelector'
import { useStrokes } from '../hooks/useStrokes'
import { analyzeDrawingStroke } from '../services/aiStrokeAnalysis'
import type { Point, ReferenceDrawing, Stroke, Tool } from '../types/drawing'
import { eraseAtPoint } from '../utils/eraser'

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
    beginEraseSession,
    eraseInSession,
    endEraseSession,
    canUndo,
    canRedo,
  } = useStrokes()

  const [brushSize, setBrushSize] = useState(5)
  const [tool, setTool] = useState<Tool>('brush')

  // Stroke-by-stroke guide state
  const [currentGuideStrokeIndex, setCurrentGuideStrokeIndex] = useState(0)
  const [isAnalyzingAI, setIsAnalyzingAI] = useState(false)
  const [aiFeedback, setAiFeedback] = useState<string | null>(null)
  const [awaitingNext, setAwaitingNext] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)

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
    () => savedReferences.find((r) => r.id === selectedReferenceId) ?? null,
    [savedReferences, selectedReferenceId],
  )

  const allReferenceStrokes = activeGuide?.strokes ?? []
  const totalStrokes = allReferenceStrokes.length
  const currentReferenceStroke = allReferenceStrokes[currentGuideStrokeIndex] ?? null

  // Show only the current guide stroke as overlay
  const guideStrokesForCanvas = currentReferenceStroke ? [currentReferenceStroke] : []

  const handleEraseAtPoint = useCallback(
    (point: Point) => {
      eraseInSession((prev) => eraseAtPoint(prev, point.x, point.y, brushSize))
    },
    [brushSize, eraseInSession],
  )

  const handleStrokeComplete = useCallback(
    async (stroke: Stroke) => {
      addStroke(stroke)
      analyzeCompletedStroke(stroke)

      if (!currentReferenceStroke) return

      setIsAnalyzingAI(true)
      setAiFeedback(null)
      setAwaitingNext(false)

      try {
        const feedback = await analyzeDrawingStroke(stroke, currentReferenceStroke)
        setAiFeedback(feedback)
      } finally {
        setIsAnalyzingAI(false)
        setAwaitingNext(true)
      }
    },
    [addStroke, analyzeCompletedStroke, currentReferenceStroke],
  )

  const handleNextStroke = useCallback(() => {
    if (currentGuideStrokeIndex >= totalStrokes - 1) {
      setIsCompleted(true)
      setAwaitingNext(false)
      return
    }
    setCurrentGuideStrokeIndex((i) => i + 1)
    setAiFeedback(null)
    setAwaitingNext(false)
    resetAnalysis()
  }, [currentGuideStrokeIndex, totalStrokes, resetAnalysis])

  const handleRetryStroke = useCallback(() => {
    undoStroke()
    setAiFeedback(null)
    setAwaitingNext(false)
    setIsAnalyzingAI(false)
    resetAnalysis()
  }, [undoStroke, resetAnalysis])

  const handleUndo = useCallback(() => {
    undoStroke()
    setAiFeedback(null)
    setAwaitingNext(false)
    resetAnalysis()
  }, [undoStroke, resetAnalysis])

  const handleClear = useCallback(() => {
    clearStrokes()
    setAiFeedback(null)
    setAwaitingNext(false)
    setIsAnalyzingAI(false)
    setCurrentGuideStrokeIndex(0)
    setIsCompleted(false)
    resetAnalysis()
  }, [clearStrokes, resetAnalysis])

  const handleRedo = useCallback(() => {
    redoStroke()
    resetAnalysis()
  }, [redoStroke, resetAnalysis])

  // Reset guide index when reference changes
  useEffect(() => {
    setCurrentGuideStrokeIndex(0)
    setAiFeedback(null)
    setAwaitingNext(false)
    setIsCompleted(false)
    resetAnalysis()
  }, [activeGuide?.id, resetAnalysis])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMetaOrCtrl = event.metaKey || event.ctrlKey
      if (!isMetaOrCtrl) return
      const key = event.key.toLowerCase()
      if (key === 'z' && !event.shiftKey && canUndo) {
        event.preventDefault()
        handleUndo()
      }
      if ((key === 'y' || (key === 'z' && event.shiftKey)) && canRedo) {
        event.preventDefault()
        handleRedo()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [canRedo, canUndo, handleRedo, handleUndo])

  const displayedSimilarity = similarityPercent
  const displayedFeedbackText = aiFeedback ?? (isAnalyzingAI ? null : feedbackText)

  return (
    <section className="flex min-h-0 w-full flex-1 flex-col gap-4">
      <ControlBar
        brushSize={brushSize}
        onBrushSizeChange={setBrushSize}
        tool={tool}
        onToolChange={setTool}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onClear={handleClear}
        canUndo={canUndo}
        canRedo={canRedo}
        extraControls={
          <button
            type="button"
            onClick={refreshReferences}
            disabled={isLoadingReferences}
            className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoadingReferences ? 'Ładowanie...' : 'Odśwież wzorce'}
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-300 bg-white p-3 shadow-sm">
        <p className="text-sm text-slate-600">
          Wzorzec:{' '}
          <span className="font-semibold text-slate-900">
            {selectedReference ? selectedReference.name : 'Brak wzorca'}
          </span>
        </p>
        <ReferenceSelector
          references={savedReferences}
          selectedId={selectedReference ? selectedReferenceId : ''}
          onSelect={setSelectedReferenceId}
          label="Wzorzec"
          emptyOptionLabel="Brak wzorca"
        />
        {totalStrokes > 0 && !isCompleted && (
          <span className="ml-auto rounded-full bg-sky-100 px-3 py-1 text-sm font-semibold text-sky-800">
            Kreska {currentGuideStrokeIndex + 1} / {totalStrokes}
          </span>
        )}
        {isCompleted && (
          <span className="ml-auto rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800">
            Ćwiczenie ukończone!
          </span>
        )}
        {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}
      </div>

      <div className="min-h-0 flex-1">
        <PracticeCanvas
          userStrokes={strokes}
          referenceStrokes={guideStrokesForCanvas}
          brushSize={brushSize}
          tool={tool}
          userStrokeColor={activeStrokeColor}
          onStrokeComplete={handleStrokeComplete}
          onCurrentStrokePointCountChange={setCurrentStrokePointCount}
          onActiveStrokeChange={analyzeActiveStroke}
          onEraseStart={beginEraseSession}
          onEraseAtPoint={handleEraseAtPoint}
          onEraseEnd={endEraseSession}
        />
      </div>

      <DebugPanel
        strokeCount={strokeCount}
        currentStrokePointCount={currentStrokePointCount}
        lastStrokeDurationMs={lastStrokeDurationMs}
      />

      <FeedbackPanel
        feedback={displayedFeedbackText}
        similarity={displayedSimilarity}
        isLoading={isAnalyzingAI}
        canProceed={awaitingNext && !isAnalyzingAI}
        canRetry={awaitingNext && !isAnalyzingAI && canUndo}
        isLastStroke={currentGuideStrokeIndex >= totalStrokes - 1}
        onNextStroke={handleNextStroke}
        onRetry={handleRetryStroke}
      />
    </section>
  )
}
