import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { referenceStorageService } from '../../teacher/services/referenceStorageService'
import { WARMUPS } from '../warmups'
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

export function mergeReferences(
  local: ReferenceDrawing | null,
  loaded: ReferenceDrawing[],
): ReferenceDrawing[] {
  const byId = new Map<string, ReferenceDrawing>()
  for (const reference of [...WARMUPS, ...(local ? [local] : []), ...loaded]) {
    if (!byId.has(reference.id)) byId.set(reference.id, reference)
  }
  return [...byId.values()]
}

export function useReferenceGuide(): UseReferenceGuideResult {
  const [searchParams] = useSearchParams()
  const { state } = useLocation()
  const localReference = (state as { localReference?: ReferenceDrawing } | null)?.localReference ?? null

  const [loaded, setLoaded] = useState<ReferenceDrawing[]>([])
  const [selectedReferenceId, setSelectedReferenceId] = useState(
    () => localReference?.id ?? searchParams.get('ref') ?? '',
  )
  const [isLoadingReferences, setIsLoadingReferences] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    referenceStorageService.loadReferences('available').then(({ data, error }) => {
      if (cancelled) return
      setLoaded(data)
      setErrorMessage(error)
      setIsLoadingReferences(false)
    })
    return () => {
      cancelled = true
    }
  }, [reloadToken])

  const references = useMemo(() => mergeReferences(localReference, loaded), [localReference, loaded])

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
      ...stroke,
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
