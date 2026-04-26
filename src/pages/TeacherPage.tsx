import { useCallback, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { ControlBar } from '../components/ControlBar'
import { DebugPanel } from '../components/DebugPanel'
import { DrawingCanvas } from '../components/DrawingCanvas'
import { ReferenceSelector } from '../components/ReferenceSelector'
import { useStrokes } from '../hooks/useStrokes'
import type { ReferenceDrawing, Stroke } from '../types/drawing'
import { cloneStrokes } from '../utils/strokes'
import {
  isStrokeCollectionEmpty,
  loadReferencesFromStorage,
  parseImportedReference,
  persistReferences,
  serializeReference,
} from '../utils/storage'

function createReferenceId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `ref-${Date.now()}`
}

function sanitizeFileName(name: string): string {
  const cleaned = name.trim().replace(/[^a-z0-9-]+/gi, '-')
  return cleaned.length > 0 ? cleaned : 'reference'
}

function createUniqueReferenceName(
  proposedName: string,
  existingReferences: ReferenceDrawing[],
): string {
  const trimmed = proposedName.trim()
  const baseName = trimmed.length > 0 ? trimmed : `Reference ${existingReferences.length + 1}`

  if (!existingReferences.some((reference) => reference.name === baseName)) {
    return baseName
  }

  let counter = 2
  let candidate = `${baseName} (${counter})`

  while (existingReferences.some((reference) => reference.name === candidate)) {
    counter += 1
    candidate = `${baseName} (${counter})`
  }

  return candidate
}

export function TeacherPage() {
  const {
    strokes,
    strokeCount,
    currentStrokePointCount,
    lastStrokeDurationMs,
    setCurrentStrokePointCount,
    replaceStrokes,
    addStroke,
    undoStroke,
    clearStrokes,
  } = useStrokes()

  const [brushSize, setBrushSize] = useState(5)
  const [savedReferences, setSavedReferences] = useState<ReferenceDrawing[]>(
    () => loadReferencesFromStorage().data,
  )
  const [selectedReferenceId, setSelectedReferenceId] = useState('')
  const [isSavingReference, setIsSavingReference] = useState(false)
  const [isImportingReference, setIsImportingReference] = useState(false)
  const [statusMessage, setStatusMessage] = useState(
    'Draw strokes and save them as a reusable reference.',
  )
  const [errorMessage, setErrorMessage] = useState<string | null>(
    () => loadReferencesFromStorage().error,
  )
  const importInputRef = useRef<HTMLInputElement>(null)

  const selectedReference = useMemo(
    () =>
      savedReferences.find((reference) => reference.id === selectedReferenceId) ?? null,
    [savedReferences, selectedReferenceId],
  )

  const commitReferences = useCallback((nextReferences: ReferenceDrawing[]) => {
    setSavedReferences(nextReferences)
    const { error } = persistReferences(nextReferences)
    setErrorMessage(error)
  }, [])

  const handleStrokeComplete = useCallback(
    (stroke: Stroke) => {
      addStroke(stroke)
    },
    [addStroke],
  )

  const handleUndo = useCallback(() => {
    undoStroke()
    setStatusMessage('Removed the latest stroke.')
  }, [undoStroke])

  const handleClear = useCallback(() => {
    clearStrokes()
    setStatusMessage('Canvas cleared.')
  }, [clearStrokes])

  const handleSaveReference = useCallback(() => {
    setErrorMessage(null)

    if (isStrokeCollectionEmpty(strokes)) {
      setStatusMessage('Draw at least one stroke before saving.')
      return
    }

    const suggestedName = `Reference ${savedReferences.length + 1}`
    const nameInput = window.prompt('Reference name', suggestedName)

    if (nameInput === null) {
      setStatusMessage('Save cancelled.')
      return
    }

    setIsSavingReference(true)

    try {
      const nextReference: ReferenceDrawing = {
        id: createReferenceId(),
        name: createUniqueReferenceName(nameInput, savedReferences),
        strokes: cloneStrokes(strokes),
        createdAt: Date.now(),
      }

      // Save a full immutable snapshot to avoid accidental mutation later.
      const nextReferences = [nextReference, ...savedReferences]
      commitReferences(nextReferences)
      setSelectedReferenceId(nextReference.id)
      setStatusMessage(`Saved "${nextReference.name}".`)
    } catch {
      setErrorMessage('Unexpected error while saving the reference.')
    } finally {
      setIsSavingReference(false)
    }
  }, [commitReferences, savedReferences, strokes])

  const handleLoadSelected = useCallback(() => {
    setErrorMessage(null)

    if (!selectedReference) {
      setStatusMessage('Select a saved reference first.')
      return
    }

    replaceStrokes(selectedReference.strokes)
    setStatusMessage(`Loaded "${selectedReference.name}" into the canvas.`)
  }, [replaceStrokes, selectedReference])

  const handleDeleteSelected = useCallback(() => {
    setErrorMessage(null)

    if (!selectedReference) {
      setStatusMessage('Select a saved reference to delete.')
      return
    }

    const nextReferences = savedReferences.filter(
      (reference) => reference.id !== selectedReference.id,
    )
    commitReferences(nextReferences)
    setSelectedReferenceId('')
    setStatusMessage(`Deleted "${selectedReference.name}".`)
  }, [commitReferences, savedReferences, selectedReference])

  const handleExportSelected = useCallback(() => {
    setErrorMessage(null)

    if (!selectedReference) {
      setStatusMessage('Select a saved reference to export.')
      return
    }

    try {
      const content = serializeReference(selectedReference)
      const blob = new Blob([content], { type: 'application/json' })
      const fileUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = fileUrl
      anchor.download = `${sanitizeFileName(selectedReference.name)}.json`
      anchor.click()
      URL.revokeObjectURL(fileUrl)
      setStatusMessage(`Exported "${selectedReference.name}" as JSON.`)
    } catch {
      setErrorMessage('Failed to export reference.')
    }
  }, [selectedReference])

  const handleImportClick = useCallback(() => {
    importInputRef.current?.click()
  }, [])

  const handleImportFile = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = ''

      if (!file) {
        return
      }

      setErrorMessage(null)
      setIsImportingReference(true)

      try {
        const jsonText = await file.text()
        const parsedResult = parseImportedReference(jsonText)

        if (parsedResult.error) {
          setErrorMessage(parsedResult.error)
          return
        }

        if (isStrokeCollectionEmpty(parsedResult.data.strokes)) {
          setErrorMessage('Imported reference contains no strokes.')
          return
        }

        const importedReference: ReferenceDrawing = {
          ...parsedResult.data,
          id: createReferenceId(),
          name: createUniqueReferenceName(parsedResult.data.name, savedReferences),
        }

        const nextReferences = [importedReference, ...savedReferences]
        commitReferences(nextReferences)
        setSelectedReferenceId(importedReference.id)
        setStatusMessage(`Imported "${importedReference.name}".`)
      } catch {
        setErrorMessage('Failed to read the selected file.')
      } finally {
        setIsImportingReference(false)
      }
    },
    [commitReferences, savedReferences],
  )

  return (
    <section className="flex min-h-0 w-full flex-1 flex-col gap-4">
      <ControlBar
        brushSize={brushSize}
        onBrushSizeChange={setBrushSize}
        onUndo={handleUndo}
        onClear={handleClear}
      />

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-300 bg-white p-3 shadow-sm">
        <button
          type="button"
          onClick={handleSaveReference}
          disabled={isSavingReference}
          className="rounded-lg border border-sky-300 bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-700 transition hover:border-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSavingReference ? 'Saving...' : 'Save Reference'}
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
          className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Load
        </button>

        <button
          type="button"
          onClick={handleDeleteSelected}
          className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Delete
        </button>

        <button
          type="button"
          onClick={handleExportSelected}
          disabled={!selectedReference}
          className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Export
        </button>

        <button
          type="button"
          onClick={handleImportClick}
          disabled={isImportingReference}
          className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isImportingReference ? 'Importing...' : 'Import JSON'}
        </button>

        <input
          ref={importInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleImportFile}
          className="hidden"
        />
      </div>

      <div className="min-h-0 flex-1">
        <DrawingCanvas
          userStrokes={strokes}
          brushSize={brushSize}
          onStrokeComplete={handleStrokeComplete}
          onCurrentStrokePointCountChange={setCurrentStrokePointCount}
        />
      </div>

      <DebugPanel
        strokeCount={strokeCount}
        currentStrokePointCount={currentStrokePointCount}
        lastStrokeDurationMs={lastStrokeDurationMs}
      />

      <section className="rounded-2xl border border-slate-300 bg-white p-4 text-sm text-slate-700 shadow-sm">
        <p className="font-medium text-slate-900">Teacher Status</p>
        <p className="mt-1">{statusMessage}</p>
        <p className="mt-2 text-slate-500">Saved references: {savedReferences.length}</p>
        {errorMessage ? <p className="mt-2 text-rose-600">{errorMessage}</p> : null}
      </section>
    </section>
  )
}
