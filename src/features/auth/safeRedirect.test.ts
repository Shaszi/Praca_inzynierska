import { describe, expect, it } from 'vitest'
import { safeRedirect } from './safeRedirect'

describe('safeRedirect', () => {
  it('przepuszcza ścieżki wewnętrzne razem z parametrami i hashem', () => {
    expect(safeRedirect('/app/practice')).toBe('/app/practice')
    expect(safeRedirect('/app/practice?ref=abc#krok')).toBe('/app/practice?ref=abc#krok')
  })

  // To jest sedno: `//evil.com` przeglądarka czyta jako adres zewnętrzny, a kod logowania
  // sklejał go z location.origin — czyli otwarte przekierowanie na obcą domenę.
  it('odrzuca adresy prowadzące poza aplikację', () => {
    expect(safeRedirect('//evil.com')).toBe('/app')
    expect(safeRedirect('///evil.com')).toBe('/app')
    expect(safeRedirect('https://evil.com')).toBe('/app')
    expect(safeRedirect('http://evil.com')).toBe('/app')
    expect(safeRedirect('javascript:alert(1)')).toBe('/app')
  })

  it('odrzuca wszystko, co nie jest ścieżką', () => {
    expect(safeRedirect(undefined)).toBe('/app')
    expect(safeRedirect(null)).toBe('/app')
    expect(safeRedirect('')).toBe('/app')
    expect(safeRedirect('app/practice')).toBe('/app')
    expect(safeRedirect(42)).toBe('/app')
    expect(safeRedirect({ from: '/app' })).toBe('/app')
  })
})
