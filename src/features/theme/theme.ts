import { useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'drawing-theme'

function systemTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function readStored(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null
  }
}

let current: Theme = typeof window === 'undefined' ? 'light' : (readStored() ?? systemTheme())
const listeners = new Set<() => void>()

/** Atrybut ustawiamy synchronicznie, zanim powiadomimy subskrybentów — inaczej
 *  odczyt zmiennych CSS przy przerysowaniu płótna trafiłby jeszcze w stary motyw. */
function apply(theme: Theme): void {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', theme)
}

export function getTheme(): Theme {
  return current
}

export function setTheme(theme: Theme): void {
  if (theme === current) return
  current = theme
  apply(theme)
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Prywatne okno albo zablokowany storage — motyw zadziała, po prostu się nie zapamięta.
  }
  for (const listener of listeners) listener()
}

export function toggleTheme(): void {
  setTheme(current === 'dark' ? 'light' : 'dark')
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, getTheme, () => 'light' as Theme)
}

/** Wywoływane raz przy starcie, żeby atrybut zgadzał się ze stanem jeszcze przed pierwszym renderem. */
export function initTheme(): void {
  apply(current)
}
