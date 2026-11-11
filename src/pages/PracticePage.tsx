import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, PageHeader } from '../components/ui'
import { DebugPanel } from '../components/DebugPanel'
import { FeedbackPanel } from '../components/FeedbackPanel'
import { Modal } from '../components/Modal'
import { BrushPanel } from '../features/canvas/components/BrushPanel'
import { useBrushSettings } from '../features/canvas/hooks/useBrushSettings'
import { PracticeToolbar } from '../features/practice/components/PracticeToolbar'
import { coverageWords } from '../features/practice/utils/coverageWords'
import { useSmoothingSettings } from '../features/canvas/hooks/useSmoothingSettings'
import { PracticeCanvas } from '../features/practice/components/PracticeCanvas'
import { usePracticeAnalysis } from '../features/practice/hooks/usePracticeAnalysis'
import { useStrokeComment } from '../features/practice/hooks/useStrokeComment'
import type { LiveProgress } from '../features/practice/utils/strokeEvaluation'
import { useReferenceGuide } from '../features/practice/hooks/useReferenceGuide'
import { isWarmupId } from '../features/practice/warmups'
import { usePracticeSession } from '../features/progress/hooks/usePracticeSession'
import { ReferenceSelector } from '../features/teacher/components/ReferenceSelector'
import { LayerPanel } from '../features/canvas/components/LayerPanel'
import { PRACTICE_LAYER_ID, useLayers } from '../features/canvas/hooks/useLayers'
import { strokesBounds } from '../features/canvas/utils/canvasPoint'
import type { Point, ReferenceDrawing, Stroke, Tool } from '../types/drawing'
import { eraseAtPoint } from '../utils/eraser'

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
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [lockedWarning, setLockedWarning] = useState<string | null>(null)
  // Krótkie okno po puszczeniu kreski, w którym wynik się odsłania. Ocena jest już
  // policzona — to animacja, nie oczekiwanie na cokolwiek.
  const [isAnalysing, setIsAnalysing] = useState(false)
  const [guideOpacity, setGuideOpacity] = useState(1)

  const [tool, setTool] = useState<Tool>('brush')
  const { smoothing } = useSmoothingSettings()

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

  // Stroke-by-stroke guide state
  const [currentGuideStrokeIndex, setCurrentGuideStrokeIndex] = useState(0)
  const [awaitingNext, setAwaitingNext] = useState(false)
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

  // Stabilna tożsamość, nie nowa tablica co render: wisi na niej `fitBounds`,
  // a od niego zależy przeliczenie widoku płótna.
  const allReferenceStrokes = useMemo(() => activeGuide?.strokes ?? [], [activeGuide])
  const totalStrokes = allReferenceStrokes.length
  const currentReferenceStroke = allReferenceStrokes[currentGuideStrokeIndex] ?? null

  // Show only the current guide stroke as overlay
  const guideStrokesForCanvas = currentReferenceStroke ? [currentReferenceStroke] : []

  // Obrys CAŁEGO wzorca, nie bieżącej kreski — inaczej płótno przeskalowywałoby się
  // przy każdym kroku i kreska 1 nie leżałaby tam, gdzie kreska 2.
  const fitBounds = useMemo(() => strokesBounds(allReferenceStrokes), [allReferenceStrokes])

  const { evaluation, live, analyzeActiveStroke, evaluateCompletedStroke, resetAnalysis } =
    usePracticeAnalysis(currentReferenceStroke)
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

  // Ocena jest liczona lokalnie i od razu — bez czekania na serwer. Komentarz modelu
  // dochodzi chwilę później i dopiero wtedy próba trafia do bazy, w jednym zapisie.
  const handleStrokeComplete = useCallback(
    (stroke: Stroke, rawPoints: Point[]) => {
      if (activeLayer?.locked) {
        setLockedWarning(activeLayer.name)
        return
      }

      // Reguła z projektu: punkty liczą się tylko z warstwy „Ćwiczenie".
      // Na szkicu można bazgrać do woli i nie psuć sobie wyniku.
      // Taka kreska nie dostaje numeru kroku, więc cofanie kroku jej nie usunie.
      if (activeLayer && activeLayer.id !== PRACTICE_LAYER_ID) {
        addStroke(stroke)
        return
      }

      const result = evaluateCompletedStroke(stroke, rawPoints)
      // Kliknięcie lub urwany ruch nie zostaje na płótnie i nie liczy się jako próba.
      if (result?.tooShort) return
      const step = currentGuideStrokeIndex
      addStroke({ ...stroke, stepIndex: step })
      if (!result) return

      setAwaitingNext(true)
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
          stroke,
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
      evaluateCompletedStroke,
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
      setAwaitingNext(false)
      completeSession(flatStrokes)
      return
    }
    setCurrentGuideStrokeIndex((i) => i + 1)
    setAwaitingNext(false)
    resetAnalysis()
  }, [currentGuideStrokeIndex, totalStrokes, resetAnalysis, resetAiComment, completeSession, flatStrokes])

  // Powtórzenie kreski: zdejmujemy właśnie tę kreskę po numerze kroku, a nie przez
  // cofnięcie historii — na jej szczycie mogło stanąć wymazanie albo zmiana warstwy.
  const handleRetryStroke = useCallback(() => {
    removeStrokesForStep(currentGuideStrokeIndex)
    discardAttempt(currentGuideStrokeIndex)
    setAwaitingNext(false)
    resetAnalysis()
    resetAiComment()
  }, [currentGuideStrokeIndex, discardAttempt, removeStrokesForStep, resetAnalysis, resetAiComment])

  const canStepBack = currentGuideStrokeIndex > 0 || awaitingNext

  /** Krok w tył: wraca do poprzedniej kreski i zdejmuje ją z płótna do narysowania od nowa. */
  const handleStepBack = useCallback(() => {
    // Gdy obecny krok ma już narysowaną kreskę, w tył cofamy najpierw ją.
    if (awaitingNext) {
      handleRetryStroke()
      return
    }
    if (currentGuideStrokeIndex === 0) return
    const target = currentGuideStrokeIndex - 1
    setCurrentGuideStrokeIndex(target)
    removeStrokesForStep(target)
    discardAttempt(target)
    setAwaitingNext(false)
    setIsCompleted(false)
    resetAnalysis()
    resetAiComment()
  }, [
    awaitingNext,
    currentGuideStrokeIndex,
    discardAttempt,
    handleRetryStroke,
    removeStrokesForStep,
    resetAnalysis,
    resetAiComment,
  ])

  const handleUndo = useCallback(() => {
    undoStroke()
    setAwaitingNext(false)
    resetAnalysis()
    resetAiComment()
  }, [undoStroke, resetAnalysis, resetAiComment])

  const handleClear = useCallback(() => {
    clearLayers()
    setAwaitingNext(false)
    setCurrentGuideStrokeIndex(0)
    setIsCompleted(false)
    resetAnalysis()
    resetAiComment()
    resetSession()
  }, [clearLayers, resetAnalysis, resetAiComment, resetSession])

  const handleRedo = useCallback(() => {
    redoStroke()
    resetAnalysis()
  }, [redoStroke, resetAnalysis])

  // Reset guide index when reference changes
  useEffect(() => {
    setCurrentGuideStrokeIndex(0)
    setAwaitingNext(false)
    setIsCompleted(false)
    resetAnalysis()
    resetAiComment()
    resetSession()
  }, [activeGuide?.id, resetAnalysis, resetAiComment, resetSession])

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
        <ReferenceSelector
          references={savedReferences}
          selectedId={selectedReference ? selectedReferenceId : ''}
          onSelect={setSelectedReferenceId}
          label="Wzorzec"
          emptyOptionLabel={isLoadingReferences ? 'Ładowanie…' : 'Wybierz wzorzec'}
        />
        <Button variant="ghost" size="sm" onClick={refreshReferences} disabled={isLoadingReferences}>
          Odśwież
        </Button>
      </PageHeader>

      {errorMessage || saveError ? (
        <p className="rounded-[16px] bg-danger-soft px-3.5 py-3 text-sm font-medium text-danger">{errorMessage ?? saveError}</p>
      ) : null}

      {/* Układ z projektu: kanwa bierze resztę, ocena siedzi w szynie 340 px i nie zasłania rysunku. */}
      <div
        className={
          isFullscreen
            ? 'fixed inset-0 z-[60] grid gap-[18px] bg-paper-dim p-4 lg:grid-cols-[minmax(0,1fr)_360px]'
            : 'grid min-h-0 flex-1 gap-[18px] lg:grid-cols-[minmax(0,1fr)_340px]'
        }
      >
        <div className="flex min-h-0 min-w-0 flex-col gap-3.5">
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
              onStepBack={handleStepBack}
              canStepBack={canStepBack}
              onUndo={handleUndo}
              onRedo={handleRedo}
              onClear={handleClear}
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

          {currentReferenceStroke ? (
            <StrokeMeter
              live={live}
              finalCoverage={awaitingNext && evaluation && !evaluation.tooShort ? evaluation.lengthRatio * 100 : null}
            />
          ) : null}

          <div className="relative flex min-h-[420px] flex-1 gap-3.5">
            {/* Panel warstw dokowany z lewej, jak `.fs-layers` w projekcie. */}
            {isLayersOpen && (
              <aside
                className="w-[290px] max-w-[88%] shrink-0 overflow-auto rounded-[18px] border border-line bg-surface p-3.5"
                aria-label="Warstwy"
              >
                <LayerPanel
                  layers={layers}
                  activeLayerId={activeLayerId}
                  guideOpacity={guideOpacity}
                  onGuideOpacity={setGuideOpacity}
                  guideStrokes={allReferenceStrokes}
                  onSelect={setActiveLayerId}
                  onToggleVisible={(id) =>
                    updateLayer(id, (layer) => ({ ...layer, visible: !layer.visible }))
                  }
                  onToggleLock={(id) => updateLayer(id, (layer) => ({ ...layer, locked: !layer.locked }))}
                  onOpacity={(id, value) => updateLayer(id, (layer) => ({ ...layer, opacity: value }))}
                  onMove={moveLayer}
                  onRemove={removeLayer}
                  onAdd={addLayer}
                />
              </aside>
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
            />
            {!selectedReference ? (
              <p className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-ink-faint">
                Wybierz wzorzec u góry, żeby zacząć.
              </p>
            ) : null}
            </div>
          </div>
        </div>

        <aside className="flex min-w-0 flex-col gap-3.5">
          <FeedbackPanel
            evaluation={evaluation}
            live={live}
            isAnalysing={isAnalysing}
            canProceed={awaitingNext}
            canRetry={awaitingNext}
            isLastStroke={currentGuideStrokeIndex >= totalStrokes - 1}
            onNextStroke={handleNextStroke}
            onRetry={handleRetryStroke}
            comment={aiComment}
            isCommentPending={isAiPending}
            commentError={aiError}
          />
        </aside>
      </div>

      {isCompleted && (
        <section className="flex flex-col gap-3 rounded-[18px] border border-success/30 bg-success-soft px-4 py-3.5 sm:flex-row sm:items-center">
          <div className="flex-1">
            <p className="font-medium text-success">Wzorzec ukończony</p>
            <p className="text-sm text-ink-soft">Rysunek zapisał się w historii i liczy się do dzisiejszego celu.</p>
          </div>
          <div className="flex gap-2">
            <Link
              to="/app/progress"
              className="flex min-h-11 items-center rounded-full border border-ink-faint bg-surface px-4 text-[15px] font-semibold text-ink transition hover:bg-surface-dim"
            >
              Zobacz postęp
            </Link>
            <Button variant="primary" onClick={handleClear}>
              Narysuj ponownie
            </Button>
          </div>
        </section>
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

/**
 * Pasek zapełniający się w trakcie ruchu: pokazuje, jaka część wzoru jest już pokryta.
 * Kolor bierze się z dokładności, więc rysowanie obok wzoru zapełnia pasek, ale na czerwono.
 * Po puszczeniu kreski pasek zostaje na wyniku końcowym, zamiast skakać do zera.
 */
function StrokeMeter({ live, finalCoverage }: { live: LiveProgress | null; finalCoverage: number | null }) {
  const coverage = Math.max(0, Math.min(100, finalCoverage ?? live?.coverage ?? 0))
  const rounded = Math.round(coverage)
  const accuracy = live?.accuracy ?? null
  const bar =
    accuracy === null ? 'bg-accent' : accuracy >= 80 ? 'bg-success' : accuracy >= 55 ? 'bg-warn' : 'bg-danger'

  return (
    <div className="flex items-center gap-3">
      <span className="min-w-[96px] text-[13px] text-ink-faint">Narysowane</span>
      <div
        className="h-2.5 flex-1 overflow-hidden rounded-full border border-line bg-paper-dim"
        role="progressbar"
        aria-label="Pokrycie aktualnego kroku"
        aria-valuenow={rounded}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={coverageWords(rounded)}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-100 ease-out ${bar}`}
          style={{ width: `${coverage}%` }}
        />
      </div>
      {/* Projekt pokazuje tu słowa, nie procent — w trakcie ruchu liczba nic nie podpowiada. */}
      <span className="min-w-10 text-right text-sm font-bold whitespace-nowrap">{coverageWords(rounded)}</span>
    </div>
  )
}

