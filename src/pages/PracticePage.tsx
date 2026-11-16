import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, PageHeader } from '../components/ui'
import { DebugPanel } from '../components/DebugPanel'
import { FeedbackPanel } from '../components/FeedbackPanel'
import { Modal } from '../components/Modal'
import { BrushPanel } from '../features/canvas/components/BrushPanel'
import { useBrushSettings } from '../features/canvas/hooks/useBrushSettings'
import { NextStepButton } from '../features/practice/components/NextStepButton'
import { PracticeLayout } from '../features/practice/components/PracticeLayout'
import { CompletedBanner } from '../features/practice/components/reference/CompletedBanner'
import { LayersDock } from '../features/practice/components/reference/LayersDock'
import { ReferencePickerModal } from '../features/practice/components/reference/ReferencePickerModal'
import { PracticeToolbar } from '../features/practice/components/PracticeToolbar'
import { useSmoothingSettings } from '../features/canvas/hooks/useSmoothingSettings'
import { PracticeCanvas } from '../features/practice/components/PracticeCanvas'
import { StrokeMeter } from '../features/practice/components/StrokeMeter'
import { usePracticeAnalysis } from '../features/practice/hooks/usePracticeAnalysis'
import { useStrokeComment } from '../features/practice/hooks/useStrokeComment'
import { useReferenceGuide } from '../features/practice/hooks/useReferenceGuide'
import { isWarmupId } from '../features/practice/warmups'
import { usePracticeSession } from '../features/progress/hooks/usePracticeSession'
import { PRACTICE_LAYER_ID, useLayers } from '../features/canvas/hooks/useLayers'
import { strokesBounds } from '../features/canvas/utils/canvasPoint'
import type { Point, ReferenceDrawing, Stroke, Tool } from '../types/drawing'
import { eraseAtPoint } from '../utils/eraser'
import { useAppSettings } from '../features/settings/useAppSettings'
import type { CanvasControls } from '../features/canvas/hooks/useCanvas'
import { TouchGestureHint } from '../features/practice/components/TouchGestureHint'
import { pathLength } from '../features/practice/contours'

export function PracticePage() {
  const {
    layers,
    activeLayer,
    activeLayerId,
    setActiveLayerId,
    flatStrokes,
    addStroke,
    removeStrokesForStep,
    addLayer,
    removeLayer,
    moveLayer,
    updateLayer,
    beginEraseSession,
    eraseInSession,
    endEraseSession,
    clear: clearLayers,
    undo: undoStroke,
    redo: redoStroke,
    canUndo,
    canRedo,
  } = useLayers()

  const [currentStrokePointCount, setCurrentStrokePointCount] = useState(0)
  const [isLayersOpen, setIsLayersOpen] = useState(false)
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [lockedWarning, setLockedWarning] = useState<string | null>(null)
  const [isAnalysing, setIsAnalysing] = useState(false)

  const [tool, setTool] = useState<Tool>('brush')
  const { smoothing } = useSmoothingSettings()
  const { settings } = useAppSettings()
  const [guideOpacity, setGuideOpacity] = useState(settings.guideOpacity)
  const canvasControls = useRef<CanvasControls | null>(null)

  useEffect(() => {
    if (!isFullscreen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsFullscreen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isFullscreen])

  useEffect(() => {
    if (!isAnalysing) return
    const timer = window.setTimeout(() => setIsAnalysing(false), 620)
    return () => window.clearTimeout(timer)
  }, [isAnalysing])

  const [currentGuideStrokeIndex, setCurrentGuideStrokeIndex] = useState(0)
  const [isBrushOpen, setIsBrushOpen] = useState(false)
  const { brush, setBrush } = useBrushSettings()
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

  const selectedReference = useMemo<ReferenceDrawing | null>(
    () => savedReferences.find((r) => r.id === selectedReferenceId) ?? null,
    [savedReferences, selectedReferenceId],
  )

  const allReferenceStrokes = useMemo(() => activeGuide?.strokes ?? [], [activeGuide])
  const totalStrokes = allReferenceStrokes.length
  const currentReferenceStroke = allReferenceStrokes[currentGuideStrokeIndex] ?? null

  const guideStrokesForCanvas = currentReferenceStroke ? [currentReferenceStroke] : []

  const fitBounds = useMemo(() => strokesBounds(allReferenceStrokes), [allReferenceStrokes])

  const stepStrokes = useMemo(
    () =>
      (layers.find((layer) => layer.id === PRACTICE_LAYER_ID)?.strokes ?? []).filter(
        (stroke) => stroke.stepIndex === currentGuideStrokeIndex,
      ),
    [layers, currentGuideStrokeIndex],
  )
  const { evaluation, live, stepProgress, analyzeActiveStroke, evaluateWithStroke, resetLive } =
    usePracticeAnalysis(currentReferenceStroke, stepStrokes)
  const awaitingNext = Boolean(evaluation && !evaluation.tooShort)
  const {
    comment: aiComment,
    isPending: isAiPending,
    error: aiError,
    request: requestAiComment,
    reset: resetAiComment,
  } = useStrokeComment()

  const sessionParams = useMemo(
    () =>
      selectedReference && totalStrokes > 0
        ? {
            mode: 'reference' as const,
            title: selectedReference.name,
            stepsTotal: totalStrokes,
            // Rozgrzewka nie ma wiersza w bazie, a kolumna jest kluczem obcym.
            referenceId: isWarmupId(selectedReference.id) ? null : selectedReference.id,
          }
        : null,
    [selectedReference, totalStrokes],
  )
  const {
    recordAttempt,
    discardAttempt,
    complete: completeSession,
    reset: resetSession,
    saveError,
  } = usePracticeSession(sessionParams)

  const handleEraseAtPoint = useCallback(
    (point: Point) => {
      if (activeLayer?.locked) {
        setLockedWarning(activeLayer.name)
        return
      }
      eraseInSession((prev) => eraseAtPoint(prev, point.x, point.y, brush.width))
    },
    [activeLayer, brush.width, eraseInSession],
  )

  const handleStrokeComplete = useCallback(
    (stroke: Stroke, rawPoints: Point[]) => {
      if (activeLayer?.locked) {
        setLockedWarning(activeLayer.name)
        return
      }

      if (activeLayer && activeLayer.id !== PRACTICE_LAYER_ID) {
        addStroke(stroke)
        return
      }

      if (stroke.points.length < 2 || pathLength(stroke.points) < 6) return
      const step = currentGuideStrokeIndex
      const tagged = { ...stroke, stepIndex: step }
      addStroke(tagged)
      const combined = evaluateWithStroke(tagged, rawPoints)
      if (!combined || combined.evaluation.tooShort) return
      const result = combined.evaluation

      setIsAnalysing(true)
      const metrics = {
        level: result.level,
        lengthRatio: result.lengthRatio,
        startGapPx: result.startGapPx,
        endGapPx: result.endGapPx,
        speedPxPerSec: result.speedPxPerSec,
        reversed: result.reversed,
        segments: result.segments.map(({ key, level, offsetPx, angleDeg, tremorPx, pauses, issues }) => ({
          key,
          level,
          offsetPx,
          angleDeg,
          tremorPx,
          pauses,
          issues: issues.map((issue) => issue.kind),
        })),
      }

      requestAiComment(`${selectedReference?.name ?? 'Wzorzec'} — kreska ${step + 1} z ${totalStrokes}`, result, (aiFeedback) => {
        recordAttempt({
          stepIndex: step,
          stroke: combined.stroke,
          score: result.score,
          feedback: result.summary,
          aiFeedback,
          metrics,
        })
      })
    },
    [
      activeLayer,
      addStroke,
      evaluateWithStroke,
      currentGuideStrokeIndex,
      recordAttempt,
      requestAiComment,
      selectedReference,
      totalStrokes,
    ],
  )

  const handleNextStroke = useCallback(() => {
    resetAiComment()
    if (currentGuideStrokeIndex >= totalStrokes - 1) {
      setIsCompleted(true)
      completeSession(flatStrokes)
      return
    }
    setCurrentGuideStrokeIndex((i) => i + 1)
    resetLive()
  }, [currentGuideStrokeIndex, totalStrokes, resetLive, resetAiComment, completeSession, flatStrokes])

  const handleRetryStroke = useCallback(() => {
    removeStrokesForStep(currentGuideStrokeIndex)
    discardAttempt(currentGuideStrokeIndex)
    resetLive()
    resetAiComment()
  }, [currentGuideStrokeIndex, discardAttempt, removeStrokesForStep, resetLive, resetAiComment])

  const handlePickReference = useCallback(
    (id: string) => {
      setSelectedReferenceId(id)
      setIsPickerOpen(false)
    },
    [setSelectedReferenceId],
  )

  const canStepBack = currentGuideStrokeIndex > 0 || stepStrokes.length > 0

  const handleStepBack = useCallback(() => {
    if (stepStrokes.length > 0) {
      handleRetryStroke()
      return
    }
    if (currentGuideStrokeIndex === 0) return
    const target = currentGuideStrokeIndex - 1
    setCurrentGuideStrokeIndex(target)
    removeStrokesForStep(target)
    discardAttempt(target)
    setIsCompleted(false)
    resetLive()
    resetAiComment()
  }, [
    currentGuideStrokeIndex,
    discardAttempt,
    handleRetryStroke,
    stepStrokes.length,
    removeStrokesForStep,
    resetLive,
    resetAiComment,
  ])

  const handleUndo = useCallback(() => {
    undoStroke()
    resetLive()
    resetAiComment()
  }, [undoStroke, resetLive, resetAiComment])

  const handleClear = useCallback(() => {
    clearLayers()
    setCurrentGuideStrokeIndex(0)
    setIsCompleted(false)
    resetLive()
    resetAiComment()
    resetSession()
  }, [clearLayers, resetLive, resetAiComment, resetSession])

  const handleRedo = useCallback(() => {
    redoStroke()
    resetLive()
  }, [redoStroke, resetLive])

  useEffect(() => {
    setCurrentGuideStrokeIndex(0)
    setIsCompleted(false)
    resetLive()
    resetAiComment()
    resetSession()
  }, [activeGuide?.id, resetLive, resetAiComment, resetSession])

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


  return (
    <section className="flex min-h-0 w-full flex-1 flex-col gap-4">
      <PageHeader title="Ćwiczenie z wzorcem" description="Odrysuj podświetloną linię jednym pociągnięciem.">
        <Button variant="primary" onClick={() => setIsPickerOpen(true)}>
          {selectedReference ? `Wzorzec: ${selectedReference.name}` : 'Wybierz wzorzec'}
        </Button>
      </PageHeader>

      {errorMessage || saveError ? (
        <p className="rounded-[16px] bg-danger-soft px-3.5 py-3 text-sm font-medium text-danger">{errorMessage ?? saveError}</p>
      ) : null}

      <PracticeLayout
        isFullscreen={isFullscreen}
        tools={
          <>
          <div className="relative">
            <PracticeToolbar
              tool={tool}
              onToolChange={setTool}
              title={selectedReference?.name ?? ''}
              stepIndex={isCompleted ? totalStrokes : currentGuideStrokeIndex}
              stepsTotal={totalStrokes}
              isLayersOpen={isLayersOpen}
              onToggleLayers={() => {
                setIsLayersOpen((open) => !open)
                setIsBrushOpen(false)
              }}
              onOpenBrush={() => setIsBrushOpen((open) => !open)}
              isBrushOpen={isBrushOpen}
              brushColor={brush.color}
              onStepBack={handleStepBack}
              canStepBack={canStepBack}
              onUndo={handleUndo}
              onRedo={handleRedo}
              onClear={handleClear}
              onRotate={(degrees) => canvasControls.current?.rotateBy(degrees)}
              onResetRotation={() => canvasControls.current?.resetRotation()}
              canUndo={canUndo}
              canRedo={canRedo}
              isFullscreen={isFullscreen}
              onToggleFullscreen={() => setIsFullscreen((open) => !open)}
            />
            {isBrushOpen && (
              <div className="absolute top-full right-0 z-20 mt-2">
                <BrushPanel brush={brush} onChange={setBrush} canvasBackground="#0d0b20" />
              </div>
            )}
          </div>

          <TouchGestureHint />

          {currentReferenceStroke ? (
            <StrokeMeter
              live={live}
              finalCoverage={stepProgress?.coverage ?? null}
            />
          ) : null}

          </>
        }
        canvas={
          <div className="relative flex min-h-[420px] flex-1 gap-3.5">
            {isLayersOpen && (
              <LayersDock
                layers={layers}
                activeLayerId={activeLayerId}
                guideOpacity={guideOpacity}
                onGuideOpacity={setGuideOpacity}
                guideStrokes={allReferenceStrokes}
                onSelect={setActiveLayerId}
                onUpdate={updateLayer}
                onMove={moveLayer}
                onRemove={removeLayer}
                onAdd={addLayer}
              />
            )}

            <div className="relative min-w-0 flex-1">
            <PracticeCanvas
              layers={layers}
              activeLayerId={activeLayerId}
              referenceStrokes={guideStrokesForCanvas}
              brushSize={brush.width}
              brushOpacity={brush.opacity}
              tool={tool}
              smoothing={smoothing}
              userStrokeColor={brush.color}
              onStrokeComplete={handleStrokeComplete}
              onCurrentStrokePointCountChange={setCurrentStrokePointCount}
              onActiveStrokeChange={analyzeActiveStroke}
              onEraseStart={beginEraseSession}
              onEraseAtPoint={handleEraseAtPoint}
              onEraseEnd={endEraseSession}
              errorMarker={awaitingNext ? evaluation?.worstPoint : null}
              fitBounds={fitBounds}
              followGuide={settings.followGuide}
              penOnly={settings.penOnly}
              allowRotation={settings.rotateGesture}
              guideOpacity={guideOpacity}
              onUndoGesture={settings.tapGestures ? handleUndo : undefined}
              onRedoGesture={settings.tapGestures ? handleRedo : undefined}
              controlsRef={canvasControls}
            />
            {awaitingNext && (
              <NextStepButton
                isLast={currentGuideStrokeIndex >= totalStrokes - 1}
                label="Następna kreska"
                onClick={handleNextStroke}
              />
            )}
            {!selectedReference ? (
              <p className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-ink-faint">
                Wybierz wzorzec u góry, żeby zacząć.
              </p>
            ) : null}
            </div>
          </div>
        }
        panel={
          <>
          <FeedbackPanel
            evaluation={evaluation}
            live={live}
            isAnalysing={isAnalysing}
            canProceed={awaitingNext}
            canRetry={stepStrokes.length > 0}
            isLastStroke={currentGuideStrokeIndex >= totalStrokes - 1}
            onNextStroke={handleNextStroke}
            onRetry={handleRetryStroke}
            comment={aiComment}
            isCommentPending={isAiPending}
            commentError={aiError}
          />
          </>
        }
      />

      {isCompleted && <CompletedBanner onRestart={handleClear} />}

      {isPickerOpen && (
        <ReferencePickerModal
          references={savedReferences}
          isLoading={isLoadingReferences}
          onRefresh={refreshReferences}
          onPick={handlePickReference}
          onClose={() => setIsPickerOpen(false)}
        />
      )}

      {lockedWarning && (
          <Modal title="Warstwa jest zablokowana" onClose={() => setLockedWarning(null)}>
            Warstwa „{lockedWarning}" jest zablokowana, więc nie da się na niej rysować ani
            wymazywać. Zdejmij kłódkę w panelu warstw albo wybierz inną warstwę.
          </Modal>
        )}

        <DebugPanel
          strokeCount={flatStrokes.length}
          currentStrokePointCount={currentStrokePointCount}
          lastStrokeDurationMs={null}
        />
    </section>
  )
}
