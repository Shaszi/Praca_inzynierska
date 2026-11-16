import { useState } from 'react'

const STORAGE_KEY = 'gesture-hint-dismissed'

const isTouchDevice = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true

export function TouchGestureHint() {
  const [hidden, setHidden] = useState(() => !isTouchDevice() || localStorage.getItem(STORAGE_KEY) === '1')
  if (hidden) return null

  return (
    <p className="m-0 flex items-center gap-2 rounded-[14px] bg-surface-dim px-3 py-2 text-[13px] text-ink-soft">
      <span className="min-w-0 flex-1">
        Stuknij <b>2 palcami</b> — cofnij, <b>3 palcami</b> — ponów. Dwa palce i obrót dłoni obracają płótno.
      </span>
      <button
        type="button"
        className="shrink-0 rounded-full px-2 py-1 font-semibold text-ink-faint hover:text-ink"
        onClick={() => {
          localStorage.setItem(STORAGE_KEY, '1')
          setHidden(true)
        }}
      >
        Rozumiem
      </button>
    </p>
  )
}
