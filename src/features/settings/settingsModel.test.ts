import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, parseSettings } from './settingsModel'

describe('parseSettings', () => {
  it('bez danych daje ustawienia domyślne', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings('tekst')).toEqual(DEFAULT_SETTINGS)
  })

  it('zachowuje poprawne wartości', () => {
    const saved = {
      followGuide: false,
      guideOpacity: 0.5,
      penOnly: true,
      tapGestures: false,
      rotateGesture: false,
      smoothing: { mode: 'rope', strength: 70 },
    }
    expect(parseSettings(saved)).toEqual(saved)
  })

  it('przycina wartości spoza zakresu i odrzuca złe typy', () => {
    const parsed = parseSettings({ guideOpacity: 7, penOnly: 'tak', smoothing: { mode: 'turbo', strength: 5 } })
    expect(parsed.guideOpacity).toBe(1)
    expect(parsed.penOnly).toBe(false)
    expect(parsed.smoothing).toEqual(DEFAULT_SETTINGS.smoothing)
    expect(parseSettings({ smoothing: { mode: 'adaptive', strength: -20 } }).smoothing.strength).toBe(0)
  })

  it('nie przepuszcza obcych pól', () => {
    expect(Object.keys(parseSettings({ followGuide: true, admin: true }))).not.toContain('admin')
  })
})
