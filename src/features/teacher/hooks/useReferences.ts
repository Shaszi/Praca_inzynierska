import { useCallback, useMemo, useState } from 'react'
import type { ReferenceDrawing, Stroke } from '../../../types/drawing'
import { downloadJSON, sanitizeFileName } from '../../../utils/file'
import { referenceService } from '../services/referenceService'
import { isStrokeCollectionEmpty } from '../utils/referenceValidation'

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
  // Keeping reference state/actions in a hook lets UI stay presentation-only and reusable.
  const [initialLoad] = useState(() => referenceService.loadReferences())
  const [references, setReferences] = useState<ReferenceDrawing[]>(initialLoad.data)
  const [selectedReferenceId, setSelectedReferenceId] = useState('')
  const [statusMessage, setStatusMessage] = useState('Draw strokes and save them as a reusable reference.')
  const [errorMessage, setErrorMessage] = useState<string | null>(initialLoad.error)
  const [isSaving, setIsSaving] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  const selectedReference = useMemo(
    () => references.find((reference) => reference.id === selectedReferenceId) ?? null,
    [references, selectedReferenceId],
  )

  const commitReferences = useCallback((nextReferences: ReferenceDrawing[]) => {
    setReferences(nextReferences)
    const saveResult = referenceService.saveReferences(nextReferences)
    setErrorMessage(saveResult.error)
  }, [])

  const saveReference = useCallback((strokes: Stroke[]) => {
    setErrorMessage(null)
    if (isStrokeCollectionEmpty(strokes)) return setStatusMessage('Draw at least one stroke before saving.')

    const nameInput = window.prompt('Reference name', `Reference ${references.length + 1}`)
    if (nameInput === null) return setStatusMessage('Save cancelled.')

    setIsSaving(true)
    try {
      const reference = referenceService.createReferenceFromStrokes(nameInput, strokes, references)
      commitReferences([reference, ...references])
      setSelectedReferenceId(reference.id)
      setStatusMessage(`Saved "${reference.name}".`)
    } catch {
      setErrorMessage('Unexpected error while saving the reference.')
    } finally {
      setIsSaving(false)
    }
  }, [commitReferences, references])

  const loadReference = useCallback((): Stroke[] | null => {
    setErrorMessage(null)
    if (!selectedReference) return setStatusMessage('Select a saved reference first.'), null
    setStatusMessage(`Loaded "${selectedReference.name}" into the canvas.`)
    return referenceService.cloneReferenceStrokes(selectedReference)
  }, [selectedReference])

  const deleteReference = useCallback(() => {
    setErrorMessage(null)
    if (!selectedReference) return setStatusMessage('Select a saved reference to delete.')
    commitReferences(references.filter((reference) => reference.id !== selectedReference.id))
    setSelectedReferenceId('')
    setStatusMessage(`Deleted "${selectedReference.name}".`)
  }, [commitReferences, references, selectedReference])

  const exportReference = useCallback(() => {
    setErrorMessage(null)
    if (!selectedReference) return setStatusMessage('Select a saved reference to export.')

    try {
      downloadJSON(selectedReference, `${sanitizeFileName(selectedReference.name)}.json`)
      setStatusMessage(`Exported "${selectedReference.name}" as JSON.`)
    } catch {
      setErrorMessage('Failed to export reference.')
    }
  }, [selectedReference])

  const importReference = useCallback(async (file: File) => {
    setErrorMessage(null)
    setIsImporting(true)

    try {
      const parsedResult = referenceService.parseImportedReference(await file.text())
      if (parsedResult.error) return void setErrorMessage(parsedResult.error)
      if (isStrokeCollectionEmpty(parsedResult.data.strokes)) return void setErrorMessage('Imported reference contains no strokes.')

      const importedReference = referenceService.prepareImportedReference(parsedResult.data, references)
      commitReferences([importedReference, ...references])
      setSelectedReferenceId(importedReference.id)
      setStatusMessage(`Imported "${importedReference.name}".`)
    } catch {
      setErrorMessage('Failed to read the selected file.')
    } finally {
      setIsImporting(false)
    }
  }, [commitReferences, references])

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