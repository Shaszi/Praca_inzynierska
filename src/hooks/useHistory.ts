import { useCallback, useMemo, useState } from 'react'

export type HistoryState<T> = {
  past: T[]
  present: T
  future: T[]
}

type UseHistoryOptions<T> = {
  maxHistory?: number
  clone?: (value: T) => T
}

type UseHistoryResult<T> = {
  state: HistoryState<T>
  set: (nextState: T) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
}

const defaultClone = <T,>(value: T): T => structuredClone(value)

export function useHistory<T>(
  initialPresent: T,
  options: UseHistoryOptions<T> = {},
): UseHistoryResult<T> {
  const { maxHistory = 50, clone = defaultClone } = options

  const [state, setState] = useState<HistoryState<T>>({
    past: [],
    present: clone(initialPresent),
    future: [],
  })

  const set = useCallback(
    (nextState: T) => {
      setState((previous) => {
        const nextPast = [...previous.past, clone(previous.present)]
        const trimmedPast = nextPast.slice(Math.max(0, nextPast.length - maxHistory))

        return {
          past: trimmedPast,
          present: clone(nextState),
          future: [],
        }
      })
    },
    [clone, maxHistory],
  )

  const undo = useCallback(() => {
    setState((previous) => {
      if (previous.past.length === 0) {
        return previous
      }

      const nextPresent = previous.past[previous.past.length - 1]
      const nextPast = previous.past.slice(0, -1)

      return {
        past: nextPast,
        present: clone(nextPresent),
        future: [clone(previous.present), ...previous.future],
      }
    })
  }, [clone])

  const redo = useCallback(() => {
    setState((previous) => {
      if (previous.future.length === 0) {
        return previous
      }

      const [nextPresent, ...nextFuture] = previous.future
      const nextPast = [...previous.past, clone(previous.present)]
      const trimmedPast = nextPast.slice(Math.max(0, nextPast.length - maxHistory))

      return {
        past: trimmedPast,
        present: clone(nextPresent),
        future: nextFuture.map(clone),
      }
    })
  }, [clone, maxHistory])

  const canUndo = useMemo(() => state.past.length > 0, [state.past.length])
  const canRedo = useMemo(() => state.future.length > 0, [state.future.length])

  return {
    state,
    set,
    undo,
    redo,
    canUndo,
    canRedo,
  }
}
