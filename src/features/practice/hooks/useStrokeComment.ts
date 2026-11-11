import { useCallback, useEffect, useRef, useState } from 'react'
import { describeAiError } from '../../../services/aiClient'
import { analyzeStroke, type StrokeComment } from '../../../services/aiStrokeAnalysis'
import type { StrokeEvaluation } from '../utils/strokeEvaluation'

type UseStrokeCommentResult = {
  comment: StrokeComment | null
  isPending: boolean
  /** Komunikat błędu do pokazania; nie jest komentarzem i nie trafia do bazy. */
  error: string | null
  /**
   * Prosi model o komentarz do kreski. `onResolved` dostaje tekst do zapisania
   * (albo null, gdy model nie odpowiedział) i nie jest wołane, jeśli wywołanie
   * zostało w międzyczasie porzucone — wtedy ta próba już nie istnieje.
   */
  request: (stepTitle: string, evaluation: StrokeEvaluation, onResolved: (aiFeedback: string | null) => void) => void
  reset: () => void
}

/**
 * Jedna analiza AI naraz. Szybkie rysowanie kilku kresek po sobie dawało wcześniej
 * kilka równoległych wywołań, których odpowiedzi ścigały się o ten sam stan — teraz
 * nowa kreska przerywa poprzednie żądanie i tylko najnowsze może cokolwiek ustawić.
 */
export function useStrokeComment(): UseStrokeCommentResult {
  const [comment, setComment] = useState<StrokeComment | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const abort = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
  }, [])

  const request = useCallback<UseStrokeCommentResult['request']>(
    (stepTitle, evaluation, onResolved) => {
      abort()
      const controller = new AbortController()
      abortRef.current = controller
      setComment(null)
      setError(null)
      setIsPending(true)

      analyzeStroke(stepTitle, evaluation, controller.signal)
        .then((next) => {
          if (controller.signal.aborted) return
          setComment(next)
          setIsPending(false)
          onResolved(`${next.mistake} ${next.fix}`)
        })
        .catch((failure: unknown) => {
          if (controller.signal.aborted) return
          // Powód wprost z serwera: „nie dotarł" nie mówi, czy to klucz, limit, czy sieć.
          // Ocena lokalna jest już pokazana, więc brak komentarza nie blokuje ćwiczenia.
          setError(describeAiError(failure))
          setIsPending(false)
          onResolved(null)
        })
    },
    [abort],
  )

  const reset = useCallback(() => {
    abort()
    setComment(null)
    setError(null)
    setIsPending(false)
  }, [abort])

  useEffect(() => abort, [abort])

  return { comment, isPending, error, request, reset }
}
