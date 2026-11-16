export type Connection = { start: number; end: number }

/**
 * Zamienia listę połączeń siatki twarzy (pary indeksów, w dowolnej kolejności) na ciągłe
 * ścieżki indeksów. Pętla (np. obrys oka) wraca do pierwszego punktu na końcu.
 */
export function chainConnections(connections: Connection[]): number[][] {
  const neighbours = new Map<number, number[]>()
  const link = (a: number, b: number) => neighbours.set(a, [...(neighbours.get(a) ?? []), b])
  for (const { start, end } of connections) {
    if (start === end) continue
    link(start, end)
    link(end, start)
  }

  const used = new Set<string>()
  const key = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`)
  const walk = (from: number): number[] => {
    const path = [from]
    let current = from
    for (;;) {
      const next = (neighbours.get(current) ?? []).find((n) => !used.has(key(current, n)))
      if (next === undefined) return path
      used.add(key(current, next))
      path.push(next)
      current = next
    }
  }

  const paths: number[][] = []
  const ends = [...neighbours.keys()].filter((n) => neighbours.get(n)!.length === 1)
  for (const start of [...ends, ...neighbours.keys()]) {
    if ((neighbours.get(start) ?? []).every((n) => used.has(key(start, n)))) continue
    const path = walk(start)
    if (path.length > 1) paths.push(path)
  }
  return paths
}
