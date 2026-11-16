/**
 * Wyciąganie konturów ze zdjęcia — lokalnie, bez modelu.
 *
 * Powód: model proszony o współrzędne linii pomocniczych mylił się o kilkanaście procent
 * szerokości kadru (oś symetrii lądowała na krawędzi przedmiotu). Piksele zdjęcia takiego
 * problemu nie mają: kontur policzony z obrazu leży na obiekcie z definicji. Modelowi
 * zostaje to, w czym jest dobry — nazwanie i uporządkowanie konturów w kroki rysowania.
 *
 * Potok jest Canny'm bez histerezy: rozmycie, gradient Sobela, wygaszanie niemaksimów,
 * próg percentylowy, śledzenie łańcuchów, upraszczanie. Histerezy nie ma, bo drugi próg
 * dokłada parametr do strojenia, a przy rysowaniu i tak odrzucamy krótkie łańcuchy.
 */

export type ContourPoint = { x: number; y: number }

export type ContourOptions = {
  /** Jaki ułamek najsilniejszych krawędzi zostaje. Mniej = tylko wyraźne kontury. */
  edgeQuantile?: number
  /** Krótsze łańcuchy (w pikselach obrazu) lecą do kosza jako szum. */
  minLengthPx?: number
  /** Tolerancja upraszczania łamanej. */
  simplifyEpsilonPx?: number
  /**
   * Jak blisko siebie mogą biec dwie linie. Bliżej = to ta sama krawędź narysowana dwa razy
   * (np. dwa boki cienkiego pasma włosów) i krótsza jest wycinana. Domyślnie 0,6% przekątnej.
   */
  minGapPx?: number
  /**
   * Które piksele wolno brać pod uwagę (np. wnętrze lassa). Krawędzie poza nimi są
   * kasowane przed śledzeniem łańcuchów, więc sama granica zaznaczenia nie staje się linią.
   */
  keep?: (x: number, y: number) => boolean
  /** Górny limit konturów — do promptu i na płótno nie ma sensu brać tysiąca. */
  maxContours?: number
}

const DEFAULTS: Required<Omit<ContourOptions, 'minGapPx' | 'keep'>> = {
  // Zmierzone na obrazkach testowych: 0.3–0.65 daje czysty obrys bez śmieci, poniżej
  // wracają cienie, powyżej gubią się dłuższe kontury. 0.45 to środek tego przedziału.
  edgeQuantile: 0.45,
  minLengthPx: 40,
  simplifyEpsilonPx: 1.6,
  maxContours: 120,
}

/**
 * Gradient poniżej tej wartości to nie krawędź, tylko ziarno matrycy albo łagodny
 * cień. Kwantyl sam tego nie odsieje: na zdjęciu z dużym gładkim tłem „najsilniejsze
 * 4 procent" to nadal prawie zero, więc tło zalewało wynik tysiącem śmieciowych linii.
 */
const NOISE_FLOOR = 18

/** Luminancja ITU-R BT.601 — ta sama, której używa konwersja do szarości w grafice. */
export function toGrayscale(rgba: Uint8ClampedArray, width: number, height: number): Float32Array {
  const gray = new Float32Array(width * height)
  for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
    gray[i] = 0.299 * rgba[p] + 0.587 * rgba[p + 1] + 0.114 * rgba[p + 2]
  }
  return gray
}

/** Rozmycie pudełkowe 3×3. Tłumi ziarno, przez które każdy piksel byłby krawędzią. */
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

/** Sobel 3×3: siła i kierunek zmiany jasności w każdym pikselu. */
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

/** Próg na kwantylu: niezależny od kontrastu zdjęcia, bo patrzy na rozkład, nie na wartość. */
export function quantileThreshold(magnitude: Float32Array, quantile: number): number {
  // Kwantyl liczony tylko z pikseli, które w ogóle są kandydatami na krawędź.
  const candidates = Float32Array.from(magnitude.filter((value) => value > NOISE_FLOOR)).sort()
  if (candidates.length === 0) return Infinity
  const index = Math.min(candidates.length - 1, Math.max(0, Math.floor(candidates.length * quantile)))
  return Math.max(NOISE_FLOOR, candidates[index])
}

/**
 * Wygaszanie niemaksimów: zostaje tylko grzbiet krawędzi, jeden piksel szerokości.
 * Bez tego Sobel daje pasma po 3–4 piksele i śledzenie plącze się w nich zamiast iść wzdłuż.
 */
export function thinEdges(gradient: Gradient, width: number, height: number, threshold: number): Uint8Array {
  const { magnitude, angle } = gradient
  const edges = new Uint8Array(magnitude.length)
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x
      const value = magnitude[i]
      if (value < threshold) continue
      // Kierunek zaokrąglony do jednej z czterech osi sąsiedztwa.
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

/**
 * Śledzenie łańcuchów: idziemy od piksela do sąsiada, aż nie ma dokąd.
 * Najpierw od końcówek (jeden sąsiad), bo łańcuch zaczęty w środku rozpada się na dwa kawałki.
 * Pętle (kontur zamknięty) nie mają końcówek i są brane w drugim przebiegu.
 */
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

/** Ramartowanie-Douglas-Peucker: zdejmuje punkty, które leżą na prostej między sąsiadami. */
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
  const taken = new Uint8Array(width * height)
  const radius = Math.max(1, Math.round(gap))
  const stamp = (p: ContourPoint) => {
    for (let dy = -radius; dy <= radius; dy++) {
      const y = p.y + dy
      if (y < 0 || y >= height) continue
      for (let dx = -radius; dx <= radius; dx++) {
        const x = p.x + dx
        if (x < 0 || x >= width || dx * dx + dy * dy > radius * radius) continue
        taken[y * width + x] = 1
      }
    }
  }
  const lag = radius * 3

  const kept: ContourPoint[][] = []
  for (const chain of [...chains].sort((a, b) => b.length - a.length)) {
    const free = chain.map(() => false)
    let run: ContourPoint[] = []
    const flush = () => {
      if (pathLength(run) >= minLength) kept.push(run)
      run = []
    }
    chain.forEach((point, i) => {
      if (i >= lag && free[i - lag]) stamp(chain[i - lag])
      free[i] = !taken[point.y * width + point.x]
      if (free[i]) run.push(point)
      else flush()
    })
    flush()
    for (let i = Math.max(0, chain.length - lag); i < chain.length; i++) if (free[i]) stamp(chain[i])
  }
  return kept
}

/**
 * Pełny potok: piksele RGBA → lista konturów w układzie obrazu, od najdłuższego.
 * Najdłuższe kontury pierwsze, bo to one niosą kształt, a nie detal.
 */
export function extractContours(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  options: ContourOptions = {},
): ContourPoint[][] {
  const { edgeQuantile, minLengthPx, simplifyEpsilonPx, maxContours } = { ...DEFAULTS, ...options }
  const minGapPx = options.minGapPx ?? Math.max(4, Math.hypot(width, height) * 0.006)
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
