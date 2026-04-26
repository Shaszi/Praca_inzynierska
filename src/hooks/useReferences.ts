import { useCallback, useMemo, useState } from 'react'
import type { ReferenceDrawing, Stroke } from '../types/drawing'
import { referenceService } from '../services/referenceService'
import { downloadJSON, sanitizeFileName } from '../utils/file'
import { isStrokeCollectionEmpty } from '../utils/storage'

const INITIAL_STATUS = 'Draw strokes and save them as a reusable reference.'

type UseReferencesResult = {
  references: ReferenceDrawing[]
  selectedReference: ReferenceDrawing | null
  selectedReferenceId: string
  setSelectedReferenceId: (id: string) => void
  saveReference: (strokes: Stroke[]) => void
  loadReference: () => Stroke[] | null
  deleteReference: () => void
  exportReference: () => void
  importReference: (file: File) => Promise<void>
  statusMessage: string
  errorMessage: string | null
  isSaving: boolean
  isImporting: boolean
}

export function useReferences(): UseReferencesResult {
  // Reference operations are centralized here so UI components stay small,
  // reusable, and focused on rendering. This also makes future scaling easier.
  const [initialLoad] = useState(() => referenceService.loadReferences())

  const [references, setReferences] = useState<ReferenceDrawing[]>(initialLoad.data)
  const [selectedReferenceId, setSelectedReferenceIdState] = useState('')
  const [statusMessage, setStatusMessage] = useState(INITIAL_STATUS)
  const [errorMessage, setErrorMessage] = useState<string | null>(initialLoad.error)
  const [isSaving, setIsSaving] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  const selectedReference = useMemo(
    () => references.find((reference) => reference.id === selectedReferenceId) ?? null,
    [references, selectedReferenceId],
  )

  const commitReferences = useCallback((nextReferences: ReferenceDrawing[]): boolean => {
    setReferences(nextReferences)
    const saveResult = referenceService.saveReferences(nextReferences)
    setErrorMessage(saveResult.error)
    return saveResult.error === null
  }, [])

  const setSelectedReferenceId = useCallback((id: string) => {
    setSelectedReferenceIdState(id)
  }, [])

  const saveReference = useCallback(
    (strokes: Stroke[]) => {
      setErrorMessage(null)

      if (isStrokeCollectionEmpty(strokes)) {
        setStatusMessage('Draw at least one stroke before saving.')
        return
      }

      const suggestedName = `Reference ${references.length + 1}`
      const nameInput = window.prompt('Reference name', suggestedName)

      if (nameInput === null) {
        setStatusMessage('Save cancelled.')
        return
      }

      setIsSaving(true)

      try {
        const newReference = referenceService.createReferenceFromStrokes(
          nameInput,
          strokes,
          references,
        )

        const nextReferences = [newReference, ...references]
        commitReferences(nextReferences)
        setSelectedReferenceIdState(newReference.id)
        setStatusMessage(`Saved "${newReference.name}".`)
      } catch {
        setErrorMessage('Unexpected error while saving the reference.')
      } finally {
        setIsSaving(false)
      }
    },
    [commitReferences, references],
  )

  const loadReference = useCallback((): Stroke[] | null => {
    setErrorMessage(null)

    if (!selectedReference) {
      setStatusMessage('Select a saved reference first.')
      return null
    }

    setStatusMessage(`Loaded "${selectedReference.name}" into the canvas.`)
    return referenceService.cloneReferenceStrokes(selectedReference)
  }, [selectedReference])

  const deleteReference = useCallback(() => {
    setErrorMessage(null)

    if (!selectedReference) {
      setStatusMessage('Select a saved reference to delete.')
      return
    }

    const nextReferences = references.filter(
      (reference) => reference.id !== selectedReference.id,
    )

    commitReferences(nextReferences)
    setSelectedReferenceIdState('')
    setStatusMessage(`Deleted "${selectedReference.name}".`)
  }, [commitReferences, references, selectedReference])

  const exportReference = useCallback(() => {
    setErrorMessage(null)

    if (!selectedReference) {
      setStatusMessage('Select a saved reference to export.')
      return
    }

    try {
      const fileName = `${sanitizeFileName(selectedReference.name)}.json`
      downloadJSON(selectedReference, fileName)
      setStatusMessage(`Exported "${selectedReference.name}" as JSON.`)
    } catch {
      setErrorMessage('Failed to export reference.')
    }
  }, [selectedReference])

  const importReference = useCallback(
    async (file: File) => {
      setErrorMessage(null)
      setIsImporting(true)

      try {
        const jsonText = await file.text()
        const parsedResult = referenceService.parseImportedReference(jsonText)

        if (parsedResult.error) {
          setErrorMessage(parsedResult.error)
          return
        }

        if (isStrokeCollectionEmpty(parsedResult.data.strokes)) {
          setErrorMessage('Imported reference contains no strokes.')
          return
        }

        const importedReference = referenceService.prepareImportedReference(
          parsedResult.data,
          references,
        )

        const nextReferences = [importedReference, ...references]
        commitReferences(nextReferences)
        setSelectedReferenceIdState(importedReference.id)
        setStatusMessage(`Imported "${importedReference.name}".`)
      } catch {
        setErrorMessage('Failed to read the selected file.')
      } finally {
        setIsImporting(false)
      }
    },
    [commitReferences, references],
  )

  return {
    references,
    selectedReference,
    selectedReferenceId,
    setSelectedReferenceId,
    saveReference,
    loadReference,
    deleteReference,
    exportReference,
    importReference,
    statusMessage,
    errorMessage,
    isSaving,
    isImporting,
  }
}
