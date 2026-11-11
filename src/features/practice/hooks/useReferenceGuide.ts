import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
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

export function useReferenceGuide(): UseReferenceGuideResult {
  const [searchParams] = useSearchParams()
  // Rozgrzewki są zawsze na liście, też zanim baza odpowie — kafelek z pulpitu
  // linkuje wprost do jednej z nich i ma zadziałać od razu.
  const [references, setReferences] = useState<ReferenceDrawing[]>(WARMUPS)
  const [selectedReferenceId, setSelectedReferenceId] = useState(() => searchParams.get('wzorzec') ?? '')
  const [isLoadingReferences, setIsLoadingReferences] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    referenceStorageService.loadReferences().then(({ data, error }) => {
      if (cancelled) return
      const all = [...WARMUPS, ...data]
      setReferences(all)
      setErrorMessage(error)
      setSelectedReferenceId((current) => (all.some((reference) => reference.id === current) ? current : ''))
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
