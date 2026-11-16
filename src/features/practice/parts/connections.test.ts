import { describe, expect, it } from 'vitest'
import { chainConnections } from './connections'

describe('chainConnections', () => {
  it('składa pomieszane połączenia pętli w jedną zamkniętą ścieżkę', () => {
    const paths = chainConnections([
      { start: 2, end: 3 },
      { start: 0, end: 1 },
      { start: 3, end: 0 },
      { start: 1, end: 2 },
    ])
    expect(paths).toHaveLength(1)
    expect(paths[0]).toHaveLength(5)
    expect(paths[0][0]).toBe(paths[0][4])
    expect(new Set(paths[0])).toEqual(new Set([0, 1, 2, 3]))
  })

  it('linia otwarta zaczyna się na końcu, nie w środku', () => {
    const paths = chainConnections([
      { start: 5, end: 6 },
      { start: 4, end: 5 },
    ])
    expect(paths).toHaveLength(1)
    expect([[4, 5, 6], [6, 5, 4]]).toContainEqual(paths[0])
  })

  it('dwie osobne pętle (np. zewnętrzny i wewnętrzny obrys ust) dają dwie ścieżki', () => {
    const loop = (ids: number[]) => ids.map((id, i) => ({ start: id, end: ids[(i + 1) % ids.length] }))
    expect(chainConnections([...loop([0, 1, 2]), ...loop([10, 11, 12, 13])])).toHaveLength(2)
  })
})
