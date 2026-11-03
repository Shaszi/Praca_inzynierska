import { useCallback, useEffect, useMemo, useState } from 'react'
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
  const [references, setReferences] = useState<ReferenceDrawing[]>([])
  const [selectedReferenceId, setSelectedReferenceId] = useState('')
  const [isLoadingReferences, setIsLoadingReferences] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    referenceService.loadReferences().then(({ data, error }) => {
      if (cancelled) return
      setReferences(data)
      setErrorMessage(error)
      setSelectedReferenceId((current) => (data.some((reference) => reference.id === current) ? current : ''))
      setIsLoadingReferences(false)
    })
    return () => {
      cancelled = true
    }
  }, [reloadToken])

  const selectedReference = useMemo(
    () => references.find((reference) => reference.id === selectedReferenceId) ?? null,
    [references, selectedReferenceId],
  )

  const refreshReferences = useCallback(() => {
    setIsLoadingReferences(true)
    setReloadToken((token) => token + 1)
  }, [])

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
