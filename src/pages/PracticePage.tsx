import { useCallback, useMemo, useState } from 'react'
import { ControlBar } from '../components/ControlBar'
import { DrawingCanvas } from '../components/DrawingCanvas'
import { FeedbackPanel } from '../components/FeedbackPanel'
import { ReferenceSelector } from '../components/ReferenceSelector'
import type { GuideType, ReferenceDrawing, Stroke } from '../types/drawing'
import { compareStrokes } from '../utils/analysis'
import { getFeedback } from '../utils/feedback'
import { loadReferences } from '../utils/storage'

export function PracticePage() {
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [brushSize, setBrushSize] = useState(5)
  const [guide, setGuide] = useState<GuideType>('line')
  const [feedback, setFeedback] = useState('Draw over the guide to get feedback.')
  const [similarity, setSimilarity] = useState<number | null>(null)
  const [savedReferences, setSavedReferences] = useState<ReferenceDrawing[]>(() =>
    loadReferences(),
  )
  const [selectedReferenceId, setSelectedReferenceId] = useState('')

  const selectedReferenceStroke = useMemo(() => {
    if (!selectedReferenceId) {
      return null
    }

    const selected = savedReferences.find(
      (reference) => reference.id === selectedReferenceId,
    )
    return selected?.strokes[0] ?? null
  }, [savedReferences, selectedReferenceId])

  const handleStrokeComplete = useCallback(
    (stroke: Stroke) => {
      setStrokes((previousStrokes) => {
        const nextStrokes = [...previousStrokes, stroke]
        console.log('Captured stroke:', stroke)
        console.log('All strokes:', nextStrokes)
        return nextStrokes
      })

      setFeedback(getFeedback(stroke))

      if (selectedReferenceStroke) {
        setSimilarity(compareStrokes(stroke, selectedReferenceStroke))
      } else {
        setSimilarity(null)
      }
    },
    [selectedReferenceStroke],
  )

  const handleUndo = useCallback(() => {
    setStrokes((previous) => previous.slice(0, -1))
    setSimilarity(null)
  }, [])

  const handleClear = useCallback(() => {
    setStrokes([])
    setFeedback('Canvas cleared. Draw over the guide to get feedback.')
    setSimilarity(null)
  }, [])

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
              className="rounded-lg border border-cyan-500/50 bg-cyan-500/10 px-3 py-1.5 text-sm font-medium text-cyan-100 transition hover:border-cyan-300"
            >
              Toggle Guide
            </button>

            <button
              type="button"
              onClick={() => setSavedReferences(loadReferences())}
              className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-100 transition hover:border-slate-400"
            >
              Reload References
            </button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-700/60 bg-slate-900/40 p-3">
        <p className="text-sm text-slate-300">
          Guide: <span className="font-semibold text-slate-100">{guide}</span>
        </p>
        <ReferenceSelector
          references={savedReferences}
          selectedId={selectedReferenceId}
          onSelect={setSelectedReferenceId}
          label="Reference"
          emptyOptionLabel="No reference"
        />
      </div>

      <div className="min-h-0 flex-1">
        <DrawingCanvas
          strokes={strokes}
          brushSize={brushSize}
          onStrokeComplete={handleStrokeComplete}
          guide={guide}
        />
      </div>

      <FeedbackPanel feedback={feedback} similarity={similarity} />
    </section>
  )
}