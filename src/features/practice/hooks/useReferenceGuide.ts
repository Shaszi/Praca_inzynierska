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

/**
 * Jedna lista wzorców do wyboru: wbudowane rozgrzewki, wzorzec wczytany z pliku
 * (jeśli przyszedł z biblioteki) i to, co oddała baza. Id decyduje o tożsamości —
 * plik z dysku może nosić id wiersza, który już jest w bazie, a dwie opcje `<select>`
 * o tym samym `value` dają niewybieralną pozycję.
 */
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
  // Plik z dysku nie trafia do bazy — biblioteka podaje go w stanie nawigacji.
  const localReference = (state as { localReference?: ReferenceDrawing } | null)?.localReference ?? null

  const [loaded, setLoaded] = useState<ReferenceDrawing[]>([])
  // `?ref=` ustawia wybór przy wejściu: tak linkuje biblioteka i kafelki rozgrzewek.
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

  // Rozgrzewki są na liście od pierwszego renderu, jeszcze zanim baza odpowie.
  const references = useMemo(() => mergeReferences(localReference, loaded), [localReference, loaded])

  // Wybór, którego nie ma na liście (wzorzec usunięty albo cofnięty z publikacji),
  // po prostu nie znajdzie wzorca — strona pokazuje wtedy prośbę o wybór. Nie ma
  // potrzeby czyścić id w efekcie.
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
