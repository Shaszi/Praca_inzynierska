import { useCallback, useEffect, useRef, useState } from 'react'
import type { Stroke } from '../../../types/drawing'
import { progressService, type PracticeMode } from '../services/progressService'

type SessionParams = {
  mode: PracticeMode
  title: string
  stepsTotal: number
  referenceId?: string | null
}

type UsePracticeSessionResult = {
  /** Zapisuje próbę; sesja w bazie jest tworzona leniwie przy pierwszej próbie. */
  recordAttempt: (attempt: Omit<Parameters<typeof progressService.recordAttempt>[0], 'sessionId'>) => void
  /** Oznacza rysunek jako ukończony — to on liczy się do dziennego celu. */
  complete: (finalStrokes: Stroke[]) => Promise<void>
  /** Porzuca próbę danego kroku: usuwa wiersz z bazy i wycofuje jej wynik ze średniej. */
  discardAttempt: (stepIndex: number) => void
  /** Porzuca bieżącą sesję (np. po zmianie wzorca lub wyczyszczeniu płótna). */
  reset: () => void
  saveError: string | null
}

/**
 * Zapisuje przebieg ćwiczenia w bazie. Błędy zapisu nie blokują rysowania —
 * są tylko raportowane przez `saveError`.
 */
export function usePracticeSession(params: SessionParams | null): UsePracticeSessionResult {
  const sessionIdRef = useRef<Promise<string> | null>(null)
  // Po kroku, nie lista: powtórzenie kreski nadpisuje swój wynik, zamiast dopisywać
  // kolejny i zawyżać średnią sesji.
  const scoresRef = useRef<Map<number, number>>(new Map())
  const [saveError, setSaveError] = useState<string | null>(null)

  const paramsRef = useRef(params)
  useEffect(() => {
    paramsRef.current = params
  }, [params])

  const report = useCallback((error: unknown) => {
    console.error(error)
    setSaveError('Nie udało się zapisać postępu. Sprawdź połączenie.')
  }, [])

  const ensureSession = useCallback((): Promise<string> | null => {
    const current = paramsRef.current
    if (!current) return null
    if (!sessionIdRef.current) {
      sessionIdRef.current = progressService.startSession(current)
      sessionIdRef.current.catch(() => {
        sessionIdRef.current = null
      })
    }
    return sessionIdRef.current
  }, [])

  const recordAttempt = useCallback<UsePracticeSessionResult['recordAttempt']>(
    (attempt) => {
      const session = ensureSession()
      if (!session) return
      if (attempt.score !== null) scoresRef.current.set(attempt.stepIndex, attempt.score)
      session
        .then((sessionId) => progressService.recordAttempt({ sessionId, ...attempt }))
        .then(() => setSaveError(null))
        .catch(report)
    },
    [ensureSession, report],
  )

  const discardAttempt = useCallback<UsePracticeSessionResult['discardAttempt']>(
    (stepIndex) => {
      scoresRef.current.delete(stepIndex)
      // Sesja jeszcze nie istnieje = nie ma czego usuwać.
      sessionIdRef.current
        ?.then((sessionId) => progressService.deleteAttempts(sessionId, stepIndex))
        .catch(report)
    },
    [report],
  )

  const reset = useCallback(() => {
    sessionIdRef.current = null
    scoresRef.current = new Map()
  }, [])

  const complete = useCallback(
    async (finalStrokes: Stroke[]) => {
      const session = ensureSession()
      const current = paramsRef.current
      if (!session || !current) return
      const scores = [...scoresRef.current.values()]
      const averageScore = scores.length
        ? Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 100) / 100
        : null
      try {
        await progressService.completeSession({
          sessionId: await session,
          stepsCompleted: current.stepsTotal,
          averageScore,
          finalStrokes,
        })
        setSaveError(null)
      } catch (error) {
        report(error)
      } finally {
        reset()
      }
    },
    [ensureSession, report, reset],
  )

  return { recordAttempt, discardAttempt, complete, reset, saveError }
}
