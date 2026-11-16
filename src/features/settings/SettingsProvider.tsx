import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/authContext'
import { SettingsContext, type SettingsSync } from './settingsContext'
import { DEFAULT_SETTINGS, parseSettings, type AppSettings } from './settingsModel'
import { settingsService } from './settingsService'

const SAVE_DELAY_MS = 600
// Ustawienia sprzed przeniesienia na konto — przenosimy je przy pierwszym logowaniu.
const LEGACY_KEYS = { app: 'app-settings', smoothing: 'drawing-smoothing-settings' }

const cacheKey = (userId: string) => `app-settings:${userId}`

function readJson(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null')
  } catch {
    return null
  }
}

function writeCache(userId: string, settings: AppSettings) {
  try {
    localStorage.setItem(cacheKey(userId), JSON.stringify(settings))
  } catch {
    // Prywatne okno — konto i tak trzyma ustawienia.
  }
}

/** Ustawienia z urządzenia sprzed zapisu na koncie (wraz ze stabilizacją z edytora). */
function legacySettings(): AppSettings | null {
  const app = readJson(LEGACY_KEYS.app)
  const smoothing = readJson(LEGACY_KEYS.smoothing)
  if (!app && !smoothing) return null
  return parseSettings({ ...(app && typeof app === 'object' ? app : {}), ...(smoothing ? { smoothing } : {}) })
}

/**
 * Ustawienia konta dla całej aplikacji. Od razu z kopii na urządzeniu (bez czekania na sieć),
 * potem z konta; zmiany zapisują się na koncie z krótkim opóźnieniem, żeby suwak nie wysyłał
 * zapytania przy każdym ruchu.
 */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [state, setState] = useState<{ userId: string | null; settings: AppSettings }>(() => ({
    userId,
    settings: userId ? parseSettings(readJson(cacheKey(userId)) ?? legacySettings()) : DEFAULT_SETTINGS,
  }))
  const [sync, setSync] = useState<SettingsSync>('local')
  const timerRef = useRef<number | null>(null)
  const pendingRef = useRef<{ userId: string; settings: AppSettings } | null>(null)

  // Zmiana konta na tym samym urządzeniu: ustawienia poprzedniego nie mogą zostać.
  const settings =
    state.userId === userId ? state.settings : userId ? parseSettings(readJson(cacheKey(userId))) : DEFAULT_SETTINGS

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    settingsService
      .load()
      .then(async (remote) => {
        if (cancelled) return
        // Użytkownik zdążył coś zmienić, zanim przyszły dane z konta — jego zmiana wygrywa.
        if (pendingRef.current) return
        if (remote) {
          writeCache(userId, remote)
          setState({ userId, settings: remote })
          setSync('saved')
          return
        }
        const local = parseSettings(readJson(cacheKey(userId)) ?? legacySettings())
        await settingsService.save(userId, local)
        if (!cancelled) setSync('saved')
      })
      .catch((error) => {
        console.error(error)
        if (!cancelled) setSync('error')
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  const update = useCallback(
    (change: Partial<AppSettings>) => {
      if (!userId) return
      const next = parseSettings({ ...settings, ...change })
      setState({ userId, settings: next })
      writeCache(userId, next)
      setSync('saving')
      pendingRef.current = { userId, settings: next }
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null
        pendingRef.current = null
        settingsService
          .save(userId, next)
          .then(() => setSync('saved'))
          .catch((error) => {
            console.error(error)
            setSync('error')
          })
      }, SAVE_DELAY_MS)
    },
    [settings, userId],
  )

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      const pending = pendingRef.current
      if (pending) void settingsService.save(pending.userId, pending.settings).catch(console.error)
    },
    [],
  )

  const value = useMemo(() => ({ settings, update, sync }), [settings, update, sync])
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}
