import { useCallback, useState } from 'react'

export type BrushSettings = {
  color: string
  /** Grubość w pikselach rysunku. */
  width: number
  /** 0–1 */
  opacity: number
}

/** Osiem barw z palety plus własna z pipety — razem dziewięć próbek, jak w projekcie. */
export const BRUSH_SWATCHES = [
  { color: '#3ee6a8', name: 'Mięta' },
  { color: '#ffd84a', name: 'Cytryna' },
  { color: '#ff5fa8', name: 'Róż' },
  { color: '#ff9a3d', name: 'Pomarańcz' },
  { color: '#4fd2ff', name: 'Błękit' },
  { color: '#9d7dff', name: 'Fiolet' },
  { color: '#f5f3ff', name: 'Biały' },
  { color: '#1a1236', name: 'Grafit' },
]

export const DEFAULT_BRUSH: BrushSettings = { color: '#3ee6a8', width: 6, opacity: 1 }

const STORAGE_KEY = 'drawing-brush-settings'

function readStored(): BrushSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_BRUSH
    const parsed = JSON.parse(raw) as Partial<BrushSettings>
    return {
      color: typeof parsed.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(parsed.color) ? parsed.color : DEFAULT_BRUSH.color,
      width: Number.isFinite(parsed.width) ? Math.min(40, Math.max(1, Number(parsed.width))) : DEFAULT_BRUSH.width,
      opacity: Number.isFinite(parsed.opacity) ? Math.min(1, Math.max(0.1, Number(parsed.opacity))) : DEFAULT_BRUSH.opacity,
    }
  } catch {
    return DEFAULT_BRUSH
  }
}

export function useBrushSettings() {
  const [brush, setBrushState] = useState<BrushSettings>(readStored)

  const setBrush = useCallback((next: BrushSettings) => {
    setBrushState(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Prywatne okno — pędzel zadziała, tylko nie przetrwa odświeżenia.
    }
  }, [])

  return { brush, setBrush }
}
