
export type ContourPoint = { x: number; y: number }

export type ContourOptions = {
  edgeQuantile?: number
  minLengthPx?: number
  simplifyEpsilonPx?: number
  minGapPx?: number
  keep?: (x: number, y: number) => boolean
  maxContours?: number
}

const DEFAULTS: Required<Omit<ContourOptions, 'minGapPx' | 'keep'>> = {
  // Zmierzone na obrazkach testowych: 0.3–0.65 daje czysty obrys bez śmieci, poniżej
  // wracają cienie, powyżej gubią się dłuższe kontury. 0.45 to środek tego przedziału.
  edgeQuantile: 0.45,
  minLengthPx: 40,
  simplifyEpsilonPx: 1.6,
  maxContours: 200,
}

const NOISE_FLOOR = 18

// Z zaznaczeniem tło jest już wycięte, a sztuczny obrys podbija rozkład gradientu —
// przy 0.45 odpadały delikatne krawędzie w środku obiektu (oko na tle skóry).
export const SELECTION_EDGE_QUANTILE = 0.2

export function toGrayscale(rgba: Uint8ClampedArray, width: number, height: number): Float32Array {
  const gray = new Float32Array(width * height)
  for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
    gray[i] = 0.299 * rgba[p] + 0.587 * rgba[p + 1] + 0.114 * rgba[p + 2]
  }
  return gray
}

export function blur3(source: Float32Array, width: number, height: number): Float32Array {
  const out = new Float32Array(source.length)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0
      let count = 0
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy
        if (yy < 0 || yy >= height) continue
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx
          if (xx < 0 || xx >= width) continue
          sum += source[yy * width + xx]
          count++
        }
      }
      out[y * width + x] = sum / count
    }
  }
  return out
}

export type Gradient = { magnitude: Float32Array; angle: Float32Array }

export function sobel(gray: Float32Array, width: number, height: number): Gradient {
  const magnitude = new Float32Array(gray.length)
  const angle = new Float32Array(gray.length)
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x
      const tl = gray[i - width - 1]
      const tc = gray[i - width]
      const tr = gray[i - width + 1]
      const ml = gray[i - 1]
      const mr = gray[i + 1]
      const bl = gray[i + width - 1]
      const bc = gray[i + width]
      const br = gray[i + width + 1]
      const gx = tr + 2 * mr + br - (tl + 2 * ml + bl)
      const gy = bl + 2 * bc + br - (tl + 2 * tc + tr)
      magnitude[i] = Math.hypot(gx, gy)
      angle[i] = Math.atan2(gy, gx)
    }
  }
  return { magnitude, angle }
}

export function quantileThreshold(magnitude: Float32Array, quantile: number): number {
  const candidates = Float32Array.from(magnitude.filter((value) => value > NOISE_FLOOR)).sort()
  if (candidates.length === 0) return Infinity
  const index = Math.min(candidates.length - 1, Math.max(0, Math.floor(candidates.length * quantile)))
  return Math.max(NOISE_FLOOR, candidates[index])
}

export function thinEdges(gradient: Gradient, width: number, height: number, threshold: number): Uint8Array {
  const { magnitude, angle } = gradient
  const edges = new Uint8Array(magnitude.length)
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x
      const value = magnitude[i]
      if (value < threshold) continue
      const sector = (Math.round(angle[i] / (Math.PI / 4)) + 4) % 4
      const step = sector === 0 ? 1 : sector === 1 ? width + 1 : sector === 2 ? width : width - 1
      if (value >= magnitude[i - step] && value >= magnitude[i + step]) edges[i] = 1
    }
  }
  return edges
}

const NEIGHBOURS = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
] as const

function countNeighbours(edges: Uint8Array, width: number, height: number, x: number, y: number): number {
  let count = 0
  for (const [dx, dy] of NEIGHBOURS) {
    const nx = x + dx
    const ny = y + dy
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
    if (edges[ny * width + nx]) count++
  }
  return count
}

export function traceChains(edges: Uint8Array, width: number, height: number): ContourPoint[][] {
  const visited = new Uint8Array(edges.length)
  const chains: ContourPoint[][] = []

  const walk = (startX: number, startY: number): ContourPoint[] => {
    const chain: ContourPoint[] = []
    let x = startX
    let y = startY
    for (;;) {
      visited[y * width + x] = 1
      chain.push({ x, y })
      let next: { x: number; y: number } | null = null
      for (const [dx, dy] of NEIGHBOURS) {
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
        const ni = ny * width + nx
        if (!edges[ni] || visited[ni]) continue
        next = { x: nx, y: ny }
        break
      }
      if (!next) return chain
      x = next.x
      y = next.y
    }
  }

  for (const endpointsFirst of [true, false]) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x
        if (!edges[i] || visited[i]) continue
        if (endpointsFirst && countNeighbours(edges, width, height, x, y) !== 1) continue
        chains.push(walk(x, y))
      }
    }
  }
  return chains
}

export function pathLength(points: ContourPoint[]): number {
  let total = 0
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
  }
  return total
}

export function simplify(points: ContourPoint[], epsilon: number): ContourPoint[] {
  if (points.length < 3) return points
  const first = points[0]
  const last = points[points.length - 1]
  let worstIndex = 0
  let worstDistance = -1

  const dx = last.x - first.x
  const dy = last.y - first.y
  const normalLength = Math.hypot(dx, dy)

  for (let i = 1; i < points.length - 1; i++) {
    const point = points[i]
    const distance =
      normalLength === 0
        ? Math.hypot(point.x - first.x, point.y - first.y)
        : Math.abs(dy * point.x - dx * point.y + last.x * first.y - last.y * first.x) / normalLength
    if (distance > worstDistance) {
      worstDistance = distance
      worstIndex = i
    }
  }

  if (worstDistance <= epsilon) return [first, last]
  return [
    ...simplify(points.slice(0, worstIndex + 1), epsilon).slice(0, -1),
    ...simplify(points.slice(worstIndex), epsilon),
  ]
}

/**
 * Usuwa dublujące się linie. Łańcuchy idą od najdłuższego; fragment, który biegnie bliżej
 * niż `gap` od już przyjętej linii, jest wycinany, a reszta łańcucha dzieli się w tym
 * miejscu na osobne kawałki. Krótkie resztki odpadają.
 *
 * Łańcuch blokuje też sam siebie, ale z opóźnieniem `lag` punktów — inaczej każdy punkt
 * blokowałby swojego sąsiada. Dzięki temu pętla wokół cienkiego kształtu (tam jednym
 * brzegiem, z powrotem drugim) zostaje jedną linią, a nie dwiema równoległymi.
 *
 * Wejście to gęste łańcuchy z `traceChains` (sąsiednie piksele), nie uproszczone łamane.
 */
export function removeOverlaps(
  chains: ContourPoint[][],
  width: number,
  height: number,
  gap: number,
  minLength: number,
): ContourPoint[][] {
  const order = chains.map((_, i) => i).sort((a, b) => chains[b].length - chains[a].length)
  return removeOverlapsInOrder(order.map((i) => chains[i]), width, height, gap, minLength).map((run) => run.points)
}

/** Jak `removeOverlaps`, ale pierwszeństwo ma kolejność wejścia; `source` to indeks linii wejściowej. */
export function removeOverlapsInOrder(
  chains: ContourPoint[][],
  width: number,
  height: number,
  gap: number,
  minLength: number,
): { points: ContourPoint[]; source: number }[] {
  const taken = new Uint8Array(width * height)
  const radius = Math.max(1, Math.round(gap))
  const stamp = (p: ContourPoint) => {
    const px = Math.round(p.x)
    const py = Math.round(p.y)
    for (let dy = -radius; dy <= radius; dy++) {
      const y = py + dy
      if (y < 0 || y >= height) continue
      for (let dx = -radius; dx <= radius; dx++) {
        const x = px + dx
        if (x < 0 || x >= width || dx * dx + dy * dy > radius * radius) continue
        taken[y * width + x] = 1
      }
    }
  }
  const isTaken = (p: ContourPoint) => {
    const x = Math.round(p.x)
    const y = Math.round(p.y)
    return x >= 0 && y >= 0 && x < width && y < height && taken[y * width + x] === 1
  }
  const lag = radius * 3

  const kept: { points: ContourPoint[]; source: number }[] = []
  chains.forEach((chain, source) => {
    const free = chain.map(() => false)
    let run: ContourPoint[] = []
    const flush = () => {
      if (pathLength(run) >= minLength) kept.push({ points: run, source })
      run = []
    }
    chain.forEach((point, i) => {
      if (i >= lag && free[i - lag]) stamp(chain[i - lag])
      free[i] = !isTaken(point)
      if (free[i]) run.push(point)
      else flush()
    })
    flush()
    for (let i = Math.max(0, chain.length - lag); i < chain.length; i++) if (free[i]) stamp(chain[i])
  })
  return kept
}

/** Punkty co ~1 px wzdłuż łamanej — usuwanie dubli sprawdza każdy piksel linii, nie tylko wierzchołki. */
export function densify(points: ContourPoint[], step = 1): ContourPoint[] {
  if (points.length < 2) return points
  const out: ContourPoint[] = [points[0]]
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step))
    for (let k = 1; k <= n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n })
  }
  return out
}

export function extractContours(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  options: ContourOptions = {},
): ContourPoint[][] {
  const { edgeQuantile, minLengthPx, simplifyEpsilonPx, maxContours } = { ...DEFAULTS, ...options }
  const minGapPx = options.minGapPx ?? Math.max(4, Math.hypot(width, height) * 0.0018)
  const gradient = sobel(blur3(toGrayscale(rgba, width, height), width, height), width, height)
  const threshold = quantileThreshold(gradient.magnitude, edgeQuantile)
  const edges = thinEdges(gradient, width, height, threshold)
  if (options.keep) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) if (!options.keep(x, y)) edges[y * width + x] = 0
    }
  }

  const chains = traceChains(edges, width, height).filter((chain) => pathLength(chain) >= minLengthPx)
  return removeOverlaps(chains, width, height, minGapPx, minLengthPx)
    .map((chain) => simplify(chain, simplifyEpsilonPx))
    .filter((chain) => chain.length >= 2)
    .sort((a, b) => pathLength(b) - pathLength(a))
    .slice(0, maxContours)
}
