import { useMemo } from 'react'

/**
 * Kontekst 2D nie przyjmuje klas Tailwinda ani zmiennych CSS — potrzebuje konkretnego
 * koloru. Dlatego kolory płótna czytamy z tych samych tokenów, których używa interfejs,
 * zamiast powielać je jako literalne hexy, które rozjeżdżają się przy zmianie palety.
 */
export function readCssColor(variable: string, fallback: string): string {
  if (typeof window === 'undefined' || typeof document === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim()
  return value || fallback
}

export type CanvasColors = {
  ink: string
  lineStrong: string
  accent: string
  success: string
  warn: string
  danger: string
  violet: string
}

/** Projekt jest jednomotywowy, więc tokeny czytamy raz — nie ma zmiany, która by to unieważniła. */
export function useCanvasColors(): CanvasColors {
  return useMemo(
    () => ({
      ink: readCssColor('--color-ink', '#f5f3ff'),
      lineStrong: readCssColor('--color-line-strong', '#4b4590'),
      accent: readCssColor('--color-accent', '#ffd84a'),
      success: readCssColor('--color-success', '#3ee6a8'),
      warn: readCssColor('--color-warn', '#ffa53d'),
      danger: readCssColor('--color-danger', '#ff6b85'),
      violet: readCssColor('--color-violet', '#9d7dff'),
    }),
    [],
  )
}
