import { useCallback, useMemo, useState } from 'react'
import { referenceService } from '../../teacher/services/referenceService'
import type { Guide, ReferenceDrawing, Stroke } from '../../../types/drawing'

type UseReferenceGuideResult = {
  references: ReferenceDrawing[]
  selectedReferenceId: string
  setSelectedReferenceId: (id: string) => void
  activeGuide: Guide | null
  referenceStrokes: Stroke[]
  isLoadingReferences: boolean
  errorMessage: string | null
  refreshReferences: () => void
}

export function useReferenceGuide(): UseReferenceGuideResult {
  const [initialLoad] = useState(() => referenceService.loadReferences())
  const [references, setReferences] = useState<ReferenceDrawing[]>(initialLoad.data)
  const [selectedReferenceId, setSelectedReferenceId] = useState('')
  const [isLoadingReferences, setIsLoadingReferences] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(initialLoad.error)

  const selectedReference = useMemo(
    () => references.find((reference) => reference.id === selectedReferenceId) ?? null,
    [references, selectedReferenceId],
  )

  const refreshReferences = useCallback(() => {
    setIsLoadingReferences(true)
    const { data, error } = referenceService.loadReferences()
    setReferences(data)
    setErrorMessage(error)

    if (!data.some((reference) => reference.id === selectedReferenceId)) {
      setSelectedReferenceId('')
    }

    setIsLoadingReferences(false)
  }, [selectedReferenceId])

  const referenceStrokes = useMemo(
    () => selectedReference?.strokes.map((stroke) => ({
      brushSize: stroke.brushSize,
      points: stroke.points.map((point) => ({ ...point })),
    })) ?? [],
    [selectedReference],
  )

  const activeGuide = useMemo<Guide | null>(() => {
    if (!selectedReference) return null

    return {
      id: selectedReference.id,
      strokes: referenceStrokes,
    }
  }, [referenceStrokes, selectedReference])

  return {
    references,
    selectedReferenceId,
    setSelectedReferenceId,
    activeGuide,
    referenceStrokes,
    isLoadingReferences,
    errorMessage,
    refreshReferences,
  }
}
