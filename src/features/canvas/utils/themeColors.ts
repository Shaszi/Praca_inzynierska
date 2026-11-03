import { useMemo } from 'react'
import { useTheme } from '../../theme/theme'

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
}

/** Przeliczane przy każdej zmianie motywu, bo wtedy te same tokeny mają inne wartości. */
export function useCanvasColors(): CanvasColors {
  const theme = useTheme()

  return useMemo(
    () => ({
      ink: readCssColor('--color-ink', '#16132a'),
      lineStrong: readCssColor('--color-line-strong', '#c6c1e3'),
      accent: readCssColor('--color-accent', '#5a2ee0'),
      success: readCssColor('--color-success', '#0d7a56'),
      warn: readCssColor('--color-warn', '#a04700'),
      danger: readCssColor('--color-danger', '#c4123f'),
    }),
    // theme jest tu właściwą zależnością: zmiana motywu zmienia wartości tokenów.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [theme],
  )
}
