import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReferenceDrawing, Stroke } from '../../../types/drawing'
import { downloadJSON, sanitizeFileName } from '../../../utils/file'
import { referenceService } from '../services/referenceService'
import { isStrokeCollectionEmpty } from '../utils/referenceValidation'

type UseReferencesResult = {
  references: ReferenceDrawing[]
  selectedReference: ReferenceDrawing | null
  selectedReferenceId: string
  setSelectedReferenceId: (id: string) => void
  saveReference: (strokes: Stroke[], name: string) => Promise<boolean>
  loadReference: (id: string) => Stroke[] | null
  deleteReference: (id: string) => Promise<void>
  exportReference: (id: string) => void
  importReference: (file: File) => Promise<void>
  statusMessage: string
  errorMessage: string | null
  isLoading: boolean
  isSaving: boolean
  isImporting: boolean
}

export function useReferences(): UseReferencesResult {
  // Keeping reference state/actions in a hook lets UI stay presentation-only and reusable.
  const [references, setReferences] = useState<ReferenceDrawing[]>([])
  const [selectedReferenceId, setSelectedReferenceId] = useState('')
  const [statusMessage, setStatusMessage] = useState('Narysuj kreski i zapisz je jako wzorzec do ćwiczeń.')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  useEffect(() => {
    let cancelled = false
    referenceService.loadReferences().then(({ data, error }) => {
      if (cancelled) return
      setReferences(data)
      setErrorMessage(error)
      setIsLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const selectedReference = useMemo(
    () => references.find((reference) => reference.id === selectedReferenceId) ?? null,
    [references, selectedReferenceId],
  )

  const persistNewReference = useCallback(
    async (name: string, strokes: Stroke[]) => {
      const { data: reference, error } = await referenceService.createReference(name, strokes, references)
      if (error || !reference) {
        setErrorMessage(error ?? 'Nie udało się zapisać wzorca.')
        return null
      }
      setReferences((current) => [reference, ...current])
      setSelectedReferenceId(reference.id)
      return reference
    },
    [references],
  )

  const saveReference = useCallback(async (strokes: Stroke[], name: string) => {
    setErrorMessage(null)
    if (isStrokeCollectionEmpty(strokes)) {
      setStatusMessage('Narysuj co najmniej jedną kreskę przed zapisem.')
      return false
    }

    setIsSaving(true)
    try {
      const reference = await persistNewReference(name.trim() || `Wzorzec ${references.length + 1}`, strokes)
      if (reference) setStatusMessage(`Zapisano „${reference.name}”.`)
      return reference !== null
    } finally {
      setIsSaving(false)
    }
  }, [persistNewReference, references.length])

  const loadReference = useCallback((id: string): Stroke[] | null => {
    setErrorMessage(null)
    const target = references.find((reference) => reference.id === id)
    if (!target) return null
    setSelectedReferenceId(id)
    setStatusMessage(`Wczytano „${target.name}” na płótno.`)
    return referenceService.cloneReferenceStrokes(target)
  }, [references])

  const deleteReference = useCallback(async (id: string) => {
    setErrorMessage(null)
    const target = references.find((reference) => reference.id === id)
    if (!target) return

    const { error } = await referenceService.deleteReference(id)
    if (error) return setErrorMessage(error)

    setReferences((current) => current.filter((reference) => reference.id !== id))
    setSelectedReferenceId((current) => (current === id ? '' : current))
    setStatusMessage(`Usunięto „${target.name}”.`)
  }, [references])

  const exportReference = useCallback((id: string) => {
    setErrorMessage(null)
    const target = references.find((reference) => reference.id === id)
    if (!target) return

    try {
      downloadJSON(target, `${sanitizeFileName(target.name)}.json`)
      setStatusMessage(`Wyeksportowano „${target.name}” do JSON.`)
    } catch {
      setErrorMessage('Nie udało się wyeksportować wzorca.')
    }
  }, [references])

  const importReference = useCallback(async (file: File) => {
    setErrorMessage(null)
    setIsImporting(true)

    try {
      const parsedResult = referenceService.parseImportedReference(await file.text())
      if (parsedResult.error) return void setErrorMessage(parsedResult.error)
      if (isStrokeCollectionEmpty(parsedResult.data.strokes)) return void setErrorMessage('Zaimportowany wzorzec nie zawiera kresek.')

      const reference = await persistNewReference(parsedResult.data.name, parsedResult.data.strokes)
      if (reference) setStatusMessage(`Zaimportowano „${reference.name}”.`)
    } catch {
      setErrorMessage('Nie udało się odczytać pliku.')
    } finally {
      setIsImporting(false)
    }
  }, [persistNewReference])

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
    isLoading,
    isSaving,
    isImporting,
  }
}
