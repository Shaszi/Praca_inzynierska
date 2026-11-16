import type { SmoothingMode, SmoothingSettings } from '../../types/drawing'
import { DEFAULT_SMOOTHING } from '../canvas/smoothing'

export type AppSettings = {
  followGuide: boolean
  /** Krycie linii, po których się rysuje, 0.15–1. */
  guideOpacity: number
  penOnly: boolean
  tapGestures: boolean
  rotateGesture: boolean
  smoothing: SmoothingSettings
}

export const DEFAULT_SETTINGS: AppSettings = {
  followGuide: true,
  guideOpacity: 1,
  penOnly: false,
  tapGestures: true,
  rotateGesture: true,
  smoothing: DEFAULT_SMOOTHING,
}

const MODES: SmoothingMode[] = ['off', 'adaptive', 'rope']
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** Ustawienia z konta albo z przeglądarki — każde pole sprawdzone, obce i błędne odrzucone. */
export function parseSettings(raw: unknown): AppSettings {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const flag = (key: 'followGuide' | 'penOnly' | 'tapGestures' | 'rotateGesture') =>
    typeof source[key] === 'boolean' ? (source[key] as boolean) : DEFAULT_SETTINGS[key]
  const smoothing = source.smoothing as Partial<SmoothingSettings> | undefined
  const validSmoothing =
    smoothing && MODES.includes(smoothing.mode as SmoothingMode) && typeof smoothing.strength === 'number'
      ? { mode: smoothing.mode as SmoothingMode, strength: clamp(smoothing.strength, 0, 100) }
      : DEFAULT_SETTINGS.smoothing

  return {
    followGuide: flag('followGuide'),
    guideOpacity:
      typeof source.guideOpacity === 'number' && Number.isFinite(source.guideOpacity)
        ? clamp(source.guideOpacity, 0.15, 1)
        : DEFAULT_SETTINGS.guideOpacity,
    penOnly: flag('penOnly'),
    tapGestures: flag('tapGestures'),
    rotateGesture: flag('rotateGesture'),
    smoothing: validSmoothing,
  }
}
