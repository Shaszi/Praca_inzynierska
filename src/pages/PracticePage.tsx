import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ControlBar } from '../components/ControlBar'
import { Button, PageHeader } from '../components/ui'
import { DebugPanel } from '../components/DebugPanel'
import { FeedbackPanel } from '../components/FeedbackPanel'
import { useSmoothingSettings } from '../features/canvas/hooks/useSmoothingSettings'
import { PracticeCanvas } from '../features/practice/components/PracticeCanvas'
import { usePracticeAnalysis } from '../features/practice/hooks/usePracticeAnalysis'
import type { LiveProgress } from '../features/practice/utils/strokeEvaluation'
import { useReferenceGuide } from '../features/practice/hooks/useReferenceGuide'
import { usePracticeSession } from '../features/progress/hooks/usePracticeSession'
import { ReferenceSelector } from '../features/teacher/components/ReferenceSelector'
import { useStrokes } from '../hooks/useStrokes'
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
  const { smoothing, setSmoothing } = useSmoothingSettings()

  // Stroke-by-stroke guide state
  const [currentGuideStrokeIndex, setCurrentGuideStrokeIndex] = useState(0)
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

  const selectedReference = useMemo<ReferenceDrawing | null>(
    () => savedReferences.find((r) => r.id === selectedReferenceId) ?? null,
    [savedReferences, selectedReferenceId],
  )

  const allReferenceStrokes = activeGuide?.strokes ?? []
  const totalStrokes = allReferenceStrokes.length
  const currentReferenceStroke = allReferenceStrokes[currentGuideStrokeIndex] ?? null

  // Show only the current guide stroke as overlay
  const guideStrokesForCanvas = currentReferenceStroke ? [currentReferenceStroke] : []

  const { evaluation, live, activeStrokeColor, analyzeActiveStroke, evaluateCompletedStroke, resetAnalysis } =
    usePracticeAnalysis(currentReferenceStroke)

  const sessionParams = useMemo(
    () =>
      selectedReference && totalStrokes > 0
        ? { mode: 'reference' as const, title: selectedReference.name, stepsTotal: totalStrokes, referenceId: selectedReference.id }
        : null,
    [selectedReference, totalStrokes],
  )
  const { recordAttempt, complete: completeSession, reset: resetSession, saveError } = usePracticeSession(sessionParams)

  const handleEraseAtPoint = useCallback(
    (point: Point) => {
      eraseInSession((prev) => eraseAtPoint(prev, point.x, point.y, brushSize))
    },
    [brushSize, eraseInSession],
  )

  // Ocena jest liczona lokalnie i od razu — bez czekania na serwer.
  const handleStrokeComplete = useCallback(
    (stroke: Stroke, rawPoints: Point[]) => {
      const result = evaluateCompletedStroke(stroke, rawPoints)
      // Kliknięcie lub urwany ruch nie zostaje na płótnie i nie liczy się jako próba.
      if (result?.tooShort) return
      addStroke(stroke)
      if (!result) return

      setAwaitingNext(true)
      recordAttempt({
        stepIndex: currentGuideStrokeIndex,
        stroke,
        score: result.score,
        feedback: result.summary,
        metrics: {
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
        },
      })
    },
    [addStroke, evaluateCompletedStroke, currentGuideStrokeIndex, recordAttempt],
  )

  const handleNextStroke = useCallback(() => {
    if (currentGuideStrokeIndex >= totalStrokes - 1) {
      setIsCompleted(true)
      setAwaitingNext(false)
      completeSession(strokes)
      return
    }
    setCurrentGuideStrokeIndex((i) => i + 1)
    setAwaitingNext(false)
    resetAnalysis()
  }, [currentGuideStrokeIndex, totalStrokes, resetAnalysis, completeSession, strokes])

  const handleRetryStroke = useCallback(() => {
    undoStroke()
    setAwaitingNext(false)
    resetAnalysis()
  }, [undoStroke, resetAnalysis])

  const handleUndo = useCallback(() => {
    undoStroke()
    setAwaitingNext(false)
    resetAnalysis()
  }, [undoStroke, resetAnalysis])

  const handleClear = useCallback(() => {
    clearStrokes()
    setAwaitingNext(false)
    setCurrentGuideStrokeIndex(0)
    setIsCompleted(false)
    resetAnalysis()
    resetSession()
  }, [clearStrokes, resetAnalysis, resetSession])

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
    resetSession()
  }, [activeGuide?.id, resetAnalysis, resetSession])

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


  const hasReferences = savedReferences.length > 0

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
        <p className="rounded-xl bg-danger-soft px-3.5 py-3 text-sm font-medium text-danger">{errorMessage ?? saveError}</p>
      ) : null}

      {!isLoadingReferences && !hasReferences ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line-strong px-6 py-16 text-center">
          <p className="text-[20px] font-bold text-ink">Nie masz jeszcze wzorców</p>
          <p className="max-w-sm text-ink-soft">
            Narysuj kilka linii w edytorze i zapisz je jako wzorzec — potem wrócisz tu je odrysować.
          </p>
          <Link
            to="/app/references"
            className="mt-2 inline-flex min-h-11 items-center rounded-[10px] bg-ink px-4 text-[15px] font-semibold text-white transition hover:bg-ink-hover"
          >
            Otwórz edytor wzorców
          </Link>
        </div>
      ) : (
        <>
          <ControlBar
            brushSize={brushSize}
            onBrushSizeChange={setBrushSize}
            tool={tool}
            onToolChange={setTool}
            smoothing={smoothing}
            onSmoothingChange={setSmoothing}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onClear={handleClear}
            canUndo={canUndo}
            canRedo={canRedo}
            extraControls={
              totalStrokes > 0 ? (
                <StepProgress current={isCompleted ? totalStrokes : currentGuideStrokeIndex} total={totalStrokes} />
              ) : null
            }
          />

          {currentReferenceStroke ? (
            <StrokeMeter
              live={live}
              finalCoverage={awaitingNext && evaluation && !evaluation.tooShort ? evaluation.lengthRatio * 100 : null}
            />
          ) : null}

          <div className="relative min-h-[420px] flex-1">
            <PracticeCanvas
              userStrokes={strokes}
              referenceStrokes={guideStrokesForCanvas}
              brushSize={brushSize}
              tool={tool}
              smoothing={smoothing}
              userStrokeColor={activeStrokeColor}
              onStrokeComplete={handleStrokeComplete}
              onCurrentStrokePointCountChange={setCurrentStrokePointCount}
              onActiveStrokeChange={analyzeActiveStroke}
              onEraseStart={beginEraseSession}
              onEraseAtPoint={handleEraseAtPoint}
              onEraseEnd={endEraseSession}
              errorMarker={awaitingNext ? evaluation?.worstPoint : null}
            />
            {!selectedReference && hasReferences ? (
              <p className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-ink-faint">
                Wybierz wzorzec u góry, żeby zacząć.
              </p>
            ) : null}
          </div>

          {isCompleted ? (
            <section className="flex flex-col gap-3 rounded-xl border border-success/30 bg-success-soft px-4 py-3.5 sm:flex-row sm:items-center">
              <div className="flex-1">
                <p className="font-medium text-success">Wzorzec ukończony</p>
                <p className="text-sm text-ink-soft">Rysunek zapisał się w historii i liczy się do dzisiejszego celu.</p>
              </div>
              <div className="flex gap-2">
                <Link
                  to="/app/progress"
                  className="flex min-h-11 items-center rounded-[10px] border border-line-strong bg-surface px-4 text-[15px] font-semibold text-ink transition hover:bg-surface-dim"
                >
                  Zobacz postęp
                </Link>
                <Button variant="primary" onClick={handleClear}>
                  Narysuj ponownie
                </Button>
              </div>
            </section>
          ) : (
            <FeedbackPanel
              evaluation={evaluation}
              canProceed={awaitingNext}
              canRetry={awaitingNext && canUndo}
              isLastStroke={currentGuideStrokeIndex >= totalStrokes - 1}
              onNextStroke={handleNextStroke}
              onRetry={handleRetryStroke}
            />
          )}

          <DebugPanel
            strokeCount={strokeCount}
            currentStrokePointCount={currentStrokePointCount}
            lastStrokeDurationMs={lastStrokeDurationMs}
          />
        </>
      )}
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
      <span className="font-mono text-xs uppercase tracking-[0.04em] text-ink-faint">Pokrycie kroku</span>
      <div
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-paper-dim"
        role="progressbar"
        aria-label="Pokrycie aktualnego kroku"
        aria-valuenow={rounded}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-100 ease-out ${bar}`}
          style={{ width: `${coverage}%` }}
        />
      </div>
      <span className="font-mono text-xs tabular-nums text-ink">{rounded}%</span>
      {live ? (
        <span className="font-mono text-xs text-ink-faint" title="Margines błędu: do tyle od wzoru kreska jeszcze się liczy">
          ±{Math.round(live.tolerancePx)} px
        </span>
      ) : null}
    </div>
  )
}

function StepProgress({ current, total }: { current: number; total: number }) {
  const done = Math.min(current, total)
  return (
    <div className="flex items-center gap-2.5" aria-label={`Kreska ${Math.min(done + 1, total)} z ${total}`}>
      <span className="font-mono text-xs uppercase tracking-[0.04em] text-ink-faint">
        {done >= total ? `${total} z ${total}` : `Kreska ${done + 1} z ${total}`}
      </span>
      {total <= 24 && (
        <span className="flex gap-[3px]">
          {Array.from({ length: total }, (_, index) => (
            <span
              key={index}
              className={[
                'h-1.5 w-3 rounded-full transition-colors',
                index < done ? 'bg-accent' : index === done ? 'bg-ink' : 'bg-paper-dim',
              ].join(' ')}
            />
          ))}
        </span>
      )}
    </div>
  )
}
