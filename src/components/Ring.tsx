import type { CSSProperties, ReactNode } from 'react'

/**
 * Pierścień postępu z projektu: conic-gradient wypełniany do `percent`,
 * z wyciętym środkiem i liczbą w kroju display.
 *
 * Wypełnienie animuje się przez zarejestrowaną własność `--ring-p` (patrz index.css) —
 * samo tło conic-gradient nie jest interpolowalne, więc bez tego skakałoby.
 */
export function Ring({
  percent,
  color = 'var(--color-accent)',
  size = 92,
  label,
  children,
}: {
  /** 0–100; wartości poza zakresem są przycinane. */
  percent: number
  /** Dowolny kolor CSS — zwykle token: var(--color-success) itd. */
  color?: string
  size?: number
  /** Opis dla czytnika ekranu; bez niego pierścień jest tylko dekoracją. */
  label?: string
  children: ReactNode
}) {
  const filled = Math.max(0, Math.min(100, percent))

  return (
    <div
      className="ring-fill relative grid shrink-0 place-items-center rounded-full"
      style={
        {
          width: size,
          height: size,
          '--ring-p': filled,
          '--ring-c': color,
        } as CSSProperties
      }
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      <span className="col-start-1 row-start-1 rounded-full bg-surface" style={{ width: '72%', height: '72%' }} />
      <b
        className="col-start-1 row-start-1 font-display font-bold leading-none"
        style={{ fontSize: Math.round(size * 0.283) }}
      >
        {children}
      </b>
    </div>
  )
}
