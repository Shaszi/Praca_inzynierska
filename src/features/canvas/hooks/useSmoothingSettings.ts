import { useCallback } from 'react'
import { useAppSettings } from '../../settings/settingsContext'
import type { SmoothingSettings } from '../../../types/drawing'

/** Stabilizacja kreski jest częścią ustawień konta — ta sama w edytorze i w ćwiczeniach. */
export function useSmoothingSettings() {
  const { settings, update } = useAppSettings()
  const setSmoothing = useCallback((smoothing: SmoothingSettings) => update({ smoothing }), [update])
  return { smoothing: settings.smoothing, setSmoothing }
}
