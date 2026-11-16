import { useCallback, useEffect, useRef, useState } from 'react'
import { describeAiError } from '../../../services/aiClient'
import { analyzeStroke, type StrokeComment } from '../../../services/aiStrokeAnalysis'
import type { StrokeEvaluation } from '../utils/strokeEvaluation'

type UseStrokeCommentResult = {
  comment: StrokeComment | null
  isPending: boolean
  error: string | null
  request: (stepTitle: string, evaluation: StrokeEvaluation, onResolved: (aiFeedback: string | null) => void) => void
  reset: () => void
}

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
