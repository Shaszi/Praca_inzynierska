import { useCallback, useState } from 'react'
import type { SmoothingMode, SmoothingSettings } from '../../../types/drawing'
import { DEFAULT_SMOOTHING } from '../smoothing'

const STORAGE_KEY = 'drawing-smoothing-settings'
const MODES: SmoothingMode[] = ['off', 'adaptive', 'rope']

function loadSettings(): SmoothingSettings {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<SmoothingSettings> | null
    if (parsed && MODES.includes(parsed.mode as SmoothingMode) && typeof parsed.strength === 'number') {
      return { mode: parsed.mode as SmoothingMode, strength: Math.min(Math.max(parsed.strength, 0), 100) }
    }
  } catch {
    // Corrupted or inaccessible storage — fall back to defaults
  }
  return DEFAULT_SMOOTHING
}

// Smoothing is a personal preference, so it is shared by all drawing pages and remembered
export function useSmoothingSettings() {
  const [smoothing, setSmoothingState] = useState<SmoothingSettings>(loadSettings)

  const setSmoothing = useCallback((next: SmoothingSettings) => {
    setSmoothingState(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Storage unavailable — the setting still applies for this session
    }
  }, [])

  return { smoothing, setSmoothing }
}
