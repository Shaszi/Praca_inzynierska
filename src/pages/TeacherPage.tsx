import { useCallback, useEffect, useMemo, useState } from 'react'
import { ControlBar } from '../components/ControlBar'
import { DrawingCanvas } from '../components/DrawingCanvas'
import { ReferenceSelector } from '../components/ReferenceSelector'
import type { ReferenceDrawing, Stroke } from '../types/drawing'
import { cloneStrokes } from '../utils/strokes'
import { loadReferences, saveReferences } from '../utils/storage'

function createReferenceId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `ref-${Date.now()}`
}

export function TeacherPage() {
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [brushSize, setBrushSize] = useState(5)
  const [savedReferences, setSavedReferences] = useState<ReferenceDrawing[]>(() =>
    loadReferences(),
  )
  const [selectedReferenceId, setSelectedReferenceId] = useState('')
  const [referenceName, setReferenceName] = useState('')
  const [statusMessage, setStatusMessage] = useState(
    'Draw strokes and save them as a reusable reference.',
  )

  const selectedReference = useMemo(
    () =>
      savedReferences.find((reference) => reference.id === selectedReferenceId) ?? null,
    [savedReferences, selectedReferenceId],
  )

  useEffect(() => {
    saveReferences(savedReferences)
  }, [savedReferences])

  const handleStrokeComplete = useCallback((stroke: Stroke) => {
    setStrokes((previousStrokes) => {
      const nextStrokes = [...previousStrokes, stroke]
      console.log('Captured stroke:', stroke)
      console.log('All strokes:', nextStrokes)
      return nextStrokes
    })
  }, [])

  const handleUndo = useCallback(() => {
    setStrokes((previous) => previous.slice(0, -1))
  }, [])

  const handleClear = useCallback(() => {
    setStrokes([])
  }, [])

  const handleSaveReference = useCallback(() => {
    if (strokes.length === 0) {
      setStatusMessage('Draw at least one stroke before saving.')
      return
    }

    const nextReference: ReferenceDrawing = {
      id: createReferenceId(),
      name: referenceName.trim() || `Reference ${savedReferences.length + 1}`,
      strokes: cloneStrokes(strokes),
      createdAt: Date.now(),
    }

    setSavedReferences((previous) => [nextReference, ...previous])
    setSelectedReferenceId(nextReference.id)
    setStatusMessage(`Saved "${nextReference.name}" to local storage.`)
    console.log('Saved reference:', nextReference)
  }, [referenceName, savedReferences.length, strokes])

  const handleLoadSelected = useCallback(() => {
    if (!selectedReference) {
      setStatusMessage('Select a saved reference first.')
      return
    }

    setStrokes(cloneStrokes(selectedReference.strokes))
    setStatusMessage(`Loaded "${selectedReference.name}" into the canvas.`)
  }, [selectedReference])

  const handleDeleteSelected = useCallback(() => {
    if (!selectedReference) {
      setStatusMessage('Select a saved reference to delete.')
      return
    }

    setSavedReferences((previous) =>
      previous.filter((reference) => reference.id !== selectedReference.id),
    )
    setSelectedReferenceId('')
    setStatusMessage(`Deleted "${selectedReference.name}".`)
  }, [selectedReference])

  return (
    <section className="flex min-h-0 w-full flex-1 flex-col gap-4">
      <ControlBar
        brushSize={brushSize}
        onBrushSizeChange={setBrushSize}
        onUndo={handleUndo}
        onClear={handleClear}
      />

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-700/60 bg-slate-900/50 p-3">
        <input
          type="text"
          value={referenceName}
          onChange={(event) => setReferenceName(event.target.value)}
          placeholder="Reference name"
          className="w-52 rounded-lg border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
        />

        <button
          type="button"
          onClick={handleSaveReference}
          className="rounded-lg border border-cyan-500/50 bg-cyan-500/10 px-3 py-1.5 text-sm font-medium text-cyan-100 transition hover:border-cyan-300"
        >
          Save Reference
        </button>

        <ReferenceSelector
          references={savedReferences}
          selectedId={selectedReferenceId}
          onSelect={setSelectedReferenceId}
          label="Saved"
          emptyOptionLabel="Select reference"
        />

        <button
          type="button"
          onClick={handleLoadSelected}
          className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-100 transition hover:border-slate-400"
        >
          Load
        </button>

        <button
          type="button"
          onClick={handleDeleteSelected}
          className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-100 transition hover:border-slate-400"
        >
          Delete
        </button>
      </div>

      <div className="min-h-0 flex-1">
        <DrawingCanvas
          strokes={strokes}
          brushSize={brushSize}
          onStrokeComplete={handleStrokeComplete}
        />
      </div>

      <section className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4 text-sm text-slate-300">
        <p className="font-medium text-slate-100">Teacher Status</p>
        <p className="mt-1">{statusMessage}</p>
        <p className="mt-2 text-slate-400">Saved references: {savedReferences.length}</p>
      </section>
    </section>
  )
}