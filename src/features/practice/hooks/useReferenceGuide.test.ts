import { describe, expect, it } from 'vitest'
import { mergeReferences } from './useReferenceGuide'
import { WARMUPS } from '../warmups'
import type { ReferenceDrawing } from '../../../types/drawing'

const reference = (id: string, name: string): ReferenceDrawing => ({
  id,
  name,
  createdAt: 0,
  strokes: [{ brushSize: 6, points: [{ x: 0, y: 0, timestamp: 0 }, { x: 10, y: 10, timestamp: 1 }] }],
})

const ids = (list: ReferenceDrawing[]) => list.map((item) => item.id)

describe('mergeReferences', () => {
  it('stawia rozgrzewki na początku, nawet gdy baza nic nie oddała', () => {
    expect(ids(mergeReferences(null, []))).toEqual(WARMUPS.map((warmup) => warmup.id))
  })

  it('dokłada wzorce z bazy za rozgrzewkami', () => {
    const merged = mergeReferences(null, [reference('db-1', 'Mój'), reference('db-2', 'Cudzy publiczny')])
    expect(ids(merged)).toEqual([...WARMUPS.map((w) => w.id), 'db-1', 'db-2'])
  })

  it('wstawia wzorzec z pliku przed tymi z bazy', () => {
    const merged = mergeReferences(reference('plik', 'Z dysku'), [reference('db-1', 'Mój')])
    expect(ids(merged)).toEqual([...WARMUPS.map((w) => w.id), 'plik', 'db-1'])
  })

  // Dwie opcje <select> o tym samym value dają pozycję, której nie da się wybrać.
  it('nie powiela id, gdy plik z dysku nosi id wiersza z bazy', () => {
    const merged = mergeReferences(reference('taki-sam', 'Z dysku'), [reference('taki-sam', 'Z bazy')])
    expect(ids(merged).filter((id) => id === 'taki-sam')).toHaveLength(1)
    // Wygrywa plik: użytkownik właśnie go wskazał.
    expect(merged.find((item) => item.id === 'taki-sam')?.name).toBe('Z dysku')
  })

  it('nie pozwala wierszowi z bazy nadpisać rozgrzewki', () => {
    const merged = mergeReferences(null, [reference(WARMUPS[0].id, 'Podszywka')])
    expect(merged.find((item) => item.id === WARMUPS[0].id)?.name).toBe(WARMUPS[0].name)
  })
})
