import { useCallback, useMemo, useState } from 'react'
import { ControlBar } from '../components/ControlBar'
import { DebugPanel } from '../components/DebugPanel'
import { DrawingCanvas } from '../components/DrawingCanvas'
import { FeedbackPanel } from '../components/FeedbackPanel'
import { ReferenceSelector } from '../components/ReferenceSelector'
import { useStrokes } from '../hooks/useStrokes'
import { referenceService } from '../services/referenceService'
import type { GuideType, ReferenceDrawing, Stroke } from '../types/drawing'
import { compareStrokes } from '../utils/analysis'
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
    clearStrokes,
  } = useStrokes()

  const [brushSize, setBrushSize] = useState(5)
  const [guide, setGuide] = useState<GuideType>('line')
  const [feedback, setFeedback] = useState('Draw over the guide to get feedback.')
  const [similarity, setSimilarity] = useState<number | null>(null)
  const [initialReferencesLoad] = useState(() => referenceService.loadReferences())
  const [savedReferences, setSavedReferences] = useState<ReferenceDrawing[]>(
    initialReferencesLoad.data,
  )
  const [selectedReferenceId, setSelectedReferenceId] = useState('')
  const [isLoadingReferences, setIsLoadingReferences] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(
    initialReferencesLoad.error,
  )

  const selectedReference = useMemo(
    () => savedReferences.find((reference) => reference.id === selectedReferenceId) ?? null,
    [savedReferences, selectedReferenceId],
  )

  const selectedReferenceStroke = useMemo(
    () => selectedReference?.strokes[0] ?? null,
    [selectedReference],
  )

  const refreshReferences = useCallback(() => {
    setIsLoadingReferences(true)
    const { data, error } = referenceService.loadReferences()
    setSavedReferences(data)
    setErrorMessage(error)

    if (!data.some((reference) => reference.id === selectedReferenceId)) {
      setSelectedReferenceId('')
      setSimilarity(null)
    }

    setIsLoadingReferences(false)
  }, [selectedReferenceId])

  const handleStrokeComplete = useCallback(
    (stroke: Stroke) => {
      addStroke(stroke)
      setFeedback(getFeedback(stroke))

      if (selectedReferenceStroke) {
        setSimilarity(compareStrokes(stroke, selectedReferenceStroke))
      } else {
        setSimilarity(null)
      }
    },
    [addStroke, selectedReferenceStroke],
  )

  const handleUndo = useCallback(() => {
    undoStroke()
    setSimilarity(null)
  }, [undoStroke])

  const handleClear = useCallback(() => {
    clearStrokes()
    setFeedback('Canvas cleared. Draw over the guide to get feedback.')
    setSimilarity(null)
  }, [clearStrokes])

  return (
    <section className="flex min-h-0 w-full flex-1 flex-col gap-4">
      <ControlBar
        brushSize={brushSize}
        onBrushSizeChange={setBrushSize}
        onUndo={handleUndo}
        onClear={handleClear}
        extraControls={
          <>
            <button
              type="button"
              onClick={() => setGuide((current) => (current === 'line' ? 'circle' : 'line'))}
              className="rounded-lg border border-sky-300 bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-700 transition hover:border-sky-400"
            >
              Toggle Guide
            </button>

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
          Guide: <span className="font-semibold text-slate-900">{guide}</span>
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
        <DrawingCanvas
          userStrokes={strokes}
          referenceStrokes={selectedReference?.strokes ?? []}
          brushSize={brushSize}
          onStrokeComplete={handleStrokeComplete}
          onCurrentStrokePointCountChange={setCurrentStrokePointCount}
          guide={guide}
        />
      </div>

      <DebugPanel
        strokeCount={strokeCount}
        currentStrokePointCount={currentStrokePointCount}
        lastStrokeDurationMs={lastStrokeDurationMs}
      />

      <FeedbackPanel feedback={feedback} similarity={similarity} />
    </section>
  )
}
