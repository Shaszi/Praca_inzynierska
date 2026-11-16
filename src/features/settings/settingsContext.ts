import { createContext, useContext } from 'react'
import { DEFAULT_SETTINGS, type AppSettings } from './settingsModel'

export type SettingsSync = 'local' | 'saving' | 'saved' | 'error'

export type SettingsContextValue = {
  settings: AppSettings
  update: (change: Partial<AppSettings>) => void
  sync: SettingsSync
}

export const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  update: () => undefined,
  sync: 'local',
})

export const useAppSettings = () => useContext(SettingsContext)
