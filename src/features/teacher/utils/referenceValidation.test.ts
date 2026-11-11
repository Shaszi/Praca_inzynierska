import { describe, expect, it } from 'vitest'
import {
  isPoint,
  isStrokeCollectionEmpty,
  normalizeReference,
  normalizeStroke,
  parseImportedReference,
} from './referenceValidation'

const point = (x: number, y: number) => ({ x, y, timestamp: 0 })
const stroke = { brushSize: 4, points: [point(0, 0), point(10, 0)] }

describe('isPoint', () => {
  it('wymaga trzech skończonych liczb', () => {
    expect(isPoint(point(1, 2))).toBe(true)
    expect(isPoint({ x: 1, y: 2 })).toBe(false)
    expect(isPoint({ x: Number.NaN, y: 2, timestamp: 0 })).toBe(false)
    expect(isPoint({ x: Infinity, y: 2, timestamp: 0 })).toBe(false)
    expect(isPoint(null)).toBe(false)
  })
})

describe('normalizeStroke', () => {
  it('migruje stary format, w którym kreska była gołą tablicą punktów', () => {
    const migrated = normalizeStroke([point(0, 0), point(5, 5)])
    expect(migrated?.brushSize).toBe(5)
    expect(migrated?.points).toHaveLength(2)
  })

  it('waliduje opcjonalny kolor i krycie', () => {
    expect(normalizeStroke({ ...stroke, color: '#ff5fa8' })?.color).toBe('#ff5fa8')
    expect(normalizeStroke({ ...stroke, color: 'red' })).toBeNull()
    expect(normalizeStroke({ ...stroke, color: '#fff' })).toBeNull()
    expect(normalizeStroke({ ...stroke, opacity: 0.5 })?.opacity).toBe(0.5)
    expect(normalizeStroke({ ...stroke, opacity: 0 })).toBeNull()
    expect(normalizeStroke({ ...stroke, opacity: 1.5 })).toBeNull()
  })

  it('odrzuca kreskę bez dodatniej grubości', () => {
    expect(normalizeStroke({ brushSize: 0, points: [point(0, 0)] })).toBeNull()
    expect(normalizeStroke({ points: [point(0, 0)] })).toBeNull()
  })
})

describe('normalizeReference', () => {
  const valid = { id: 'abc', name: 'Wzorzec', strokes: [stroke], createdAt: 1_700_000_000_000 }

  it('przepuszcza poprawny wzorzec', () => {
    expect(normalizeReference(valid)?.name).toBe('Wzorzec')
  })

  // To jest powód, dla którego import przeszedł na tę funkcję: kopiuje po białej liście.
  it('obcina obce pola z obcego pliku', () => {
    const result = normalizeReference({ ...valid, isAdmin: true, publication: 'public' }) as Record<string, unknown>
    expect(result).not.toHaveProperty('isAdmin')
    expect(result).not.toHaveProperty('publication')
    expect(Object.keys(result).sort()).toEqual(['createdAt', 'id', 'name', 'strokes'])
  })

  it('odrzuca brakujące i puste pola', () => {
    expect(normalizeReference({ ...valid, id: '' })).toBeNull()
    expect(normalizeReference({ ...valid, name: '   ' })).toBeNull()
    expect(normalizeReference({ ...valid, createdAt: 'wczoraj' })).toBeNull()
    expect(normalizeReference({ ...valid, strokes: 'brak' })).toBeNull()
    expect(normalizeReference(null)).toBeNull()
  })

  it('odrzuca cały wzorzec, gdy choć jedna kreska jest zepsuta', () => {
    expect(normalizeReference({ ...valid, strokes: [stroke, { brushSize: 4 }] })).toBeNull()
  })
})

describe('parseImportedReference', () => {
  it('zwraca wzorzec z poprawnego pliku', () => {
    const json = JSON.stringify({ id: 'a', name: 'Test', strokes: [stroke], createdAt: 1 })
    expect(parseImportedReference(json).data?.name).toBe('Test')
  })

  it('rozróżnia zepsuty JSON od zepsutej struktury', () => {
    expect(parseImportedReference('{nie json').error).toContain('JSON')
    expect(parseImportedReference('{"a":1}').error).toContain('wzorzec')
  })
})

describe('isStrokeCollectionEmpty', () => {
  it('pusta tablica i kreski bez punktów liczą się jako brak rysunku', () => {
    expect(isStrokeCollectionEmpty([])).toBe(true)
    expect(isStrokeCollectionEmpty([{ brushSize: 4, points: [] }])).toBe(true)
    expect(isStrokeCollectionEmpty([stroke])).toBe(false)
  })
})
