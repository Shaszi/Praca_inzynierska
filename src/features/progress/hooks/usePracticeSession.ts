import { useCallback, useEffect, useRef, useState } from 'react'
import type { Stroke } from '../../../types/drawing'
import { progressService, type PracticeMode } from '../services/progressService'

type SessionParams = {
  mode: PracticeMode
  title: string
  stepsTotal: number
  referenceId?: string | null
  photoPath?: string | null
  course?: unknown[] | null
  existingSessionId?: string | null
}

type UsePracticeSessionResult = {
  recordAttempt: (attempt: Omit<Parameters<typeof progressService.recordAttempt>[0], 'sessionId'>) => void
  complete: (finalStrokes: Stroke[]) => Promise<void>
  discardAttempt: (stepIndex: number) => void
  reset: () => void
  saveProgress: (stepIndex: number, strokes: Stroke[]) => void
  rename: (title: string) => Promise<string>
  saveError: string | null
}

export function usePracticeSession(params: SessionParams | null): UsePracticeSessionResult {
  const sessionIdRef = useRef<Promise<string> | null>(null)
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
      sessionIdRef.current = current.existingSessionId
        ? Promise.resolve(current.existingSessionId)
        : progressService.startSession(current)
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
      sessionIdRef.current
        ?.then((sessionId) => progressService.deleteAttempts(sessionId, stepIndex))
        .catch(report)
    },
    [report],
  )

  const saveProgress = useCallback<UsePracticeSessionResult['saveProgress']>(
    (stepIndex, strokes) => {
      const session = ensureSession()
      if (!session) return
      session
        .then((sessionId) => progressService.saveProgress({ sessionId, stepIndex, strokes }))
        .then(() => setSaveError(null))
        .catch(report)
    },
    [ensureSession, report],
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

  const rename = useCallback(async (title: string) => {
    const session = sessionIdRef.current
    return session ? progressService.renameProject(await session, title) : title.trim()
  }, [])

  return { recordAttempt, discardAttempt, complete, reset, saveProgress, rename, saveError }
}
