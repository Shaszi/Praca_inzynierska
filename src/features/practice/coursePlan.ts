import { pathLength, type ContourPoint } from './contours'
import type { SubjectMask } from './subjectMask'

/**
 * Układanie kursu z konturów — po stronie programu, nie modelu.
 *
 * Model ustalał wcześniej i kolejność, i to, które linie zostają. Wychodziło losowo:
 * krok po obrysie, potem kreska ze środka, potem znów obrys, a cieniowanie trafiało do kursu
 * na równi z sylwetką. Tu decyduje geometria, tak jak uczy się rysunku:
 *   1. obrys — linie na granicy zaznaczonego obiektu, od góry,
 *   2. konstrukcja — długie linie wewnątrz,
 *   3. detal — krótsze linie wewnątrz; najkrótsze (faktura, cienie) wypadają.
 * W każdej grupie kolejna linia zaczyna się tam, gdzie skończyła poprzednia — ręka nie skacze.
 * Modelowi zostaje nazwanie kroków.
 */

export type ContourRole = 'outline' | 'structure' | 'detail'
export type PlannedContour = { points: ContourPoint[]; role: ContourRole }

/** Linia wewnątrz krótsza niż to (ułamek przekątnej) to faktura albo cień, nie kształt. */
const MIN_DETAIL = 0.025
/** Od tej długości (ułamek przekątnej) linia wewnątrz niesie bryłę. */
const STRUCTURE = 0.07
/** Tyle punktów konturu musi leżeć na granicy maski, żeby uznać go za obrys. */
const OUTLINE_SHARE = 0.6
/** Górny limit kroków — kurs z setką kresek nikogo niczego nie nauczy. */
const MAX_STEPS = 45

/** Siatka w rozdzielczości maski: 1 = w odległości `radius` od granicy obiektu. */
export function nearBoundary(mask: SubjectMask, radius: number): Uint8Array {
  const { data, width, height } = mask
  const out = new Uint8Array(width * height)
  const r = Math.max(1, Math.round(radius))
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x
      if (!data[i]) continue
      const edge =
        x === 0 || y === 0 || x === width - 1 || y === height - 1 ||
        !data[i - 1] || !data[i + 1] || !data[i - width] || !data[i + width]
      if (!edge) continue
      for (let dy = -r; dy <= r; dy++) {
        const yy = y + dy
        if (yy < 0 || yy >= height) continue
        for (let dx = -r; dx <= r; dx++) {
          const xx = x + dx
          if (xx >= 0 && xx < width && dx * dx + dy * dy <= r * r) out[yy * width + xx] = 1
        }
      }
    }
  }
  return out
}

/** Rola każdego konturu; bez maski nie ma czego nazwać obrysem, więc liczy się sama długość. */
export function classifyContours(
  contours: ContourPoint[][],
  width: number,
  height: number,
  mask: SubjectMask | null,
): ContourRole[] {
  const diagonal = Math.hypot(width, height)
  // Granica w pikselach maski: ~1% przekątnej, bo obrys konturów leży o włos od krawędzi maski.
  const boundary = mask ? nearBoundary(mask, (Math.hypot(mask.width, mask.height) * 0.01)) : null
  return contours.map((points) => {
    if (boundary && mask) {
      let on = 0
      for (const p of points) {
        const mx = Math.min(mask.width - 1, Math.floor((p.x * mask.width) / width))
        const my = Math.min(mask.height - 1, Math.floor((p.y * mask.height) / height))
        on += boundary[my * mask.width + mx]
      }
      if (on / points.length >= OUTLINE_SHARE) return 'outline'
    }
    return pathLength(points) / diagonal >= STRUCTURE ? 'structure' : 'detail'
  })
}

const isClosed = (points: ContourPoint[]) =>
  Math.hypot(points[0].x - points[points.length - 1].x, points[0].y - points[points.length - 1].y) <
  0.15 * pathLength(points)

const distance = (a: ContourPoint, b: ContourPoint) => Math.hypot(a.x - b.x, a.y - b.y)

/**
 * Kontur ustawiony tak, żeby zaczynał się najbliżej pióra: otwarty — odwrócony, jeśli bliżej
 * jest drugi koniec; zamknięty — obrócony, żeby startował z najbliższego punktu.
 */
function startNear(points: ContourPoint[], pen: ContourPoint): { points: ContourPoint[]; gap: number } {
  if (isClosed(points)) {
    let best = 0
    points.forEach((p, i) => {
      if (distance(p, pen) < distance(points[best], pen)) best = i
    })
    // Bez ostatniego punktu przed obrotem — zamknięty kontur ma go zdublowanego z pierwszym.
    const ring = distance(points[0], points[points.length - 1]) < 1e-6 ? points.slice(0, -1) : points
    const rotated = [...ring.slice(best % ring.length), ...ring.slice(0, best % ring.length)]
    return { points: [...rotated, rotated[0]], gap: distance(points[best], pen) }
  }
  const head = distance(points[0], pen)
  const tail = distance(points[points.length - 1], pen)
  return head <= tail ? { points, gap: head } : { points: [...points].reverse(), gap: tail }
}

/** Kolejność w jednej grupie: zawsze najbliższa linia od miejsca, gdzie skończyła się poprzednia. */
function chain(contours: ContourPoint[][], pen: ContourPoint): { ordered: ContourPoint[][]; pen: ContourPoint } {
  const left = [...contours]
  const ordered: ContourPoint[][] = []
  while (left.length > 0) {
    let bestIndex = 0
    let best = startNear(left[0], pen)
    for (let i = 1; i < left.length; i++) {
      const candidate = startNear(left[i], pen)
      if (candidate.gap < best.gap) {
        best = candidate
        bestIndex = i
      }
    }
    left.splice(bestIndex, 1)
    ordered.push(best.points)
    pen = best.points[best.points.length - 1]
  }
  return { ordered, pen }
}

/** Pełny plan: role, odsianie faktury, kolejność obrys → konstrukcja → detal. */
export function planCourse(
  contours: ContourPoint[][],
  width: number,
  height: number,
  mask: SubjectMask | null,
): PlannedContour[] {
  const diagonal = Math.hypot(width, height)
  const roles = classifyContours(contours, width, height, mask)
  const byRole = (role: ContourRole) =>
    contours
      .filter((points, i) => roles[i] === role && (role !== 'detail' || pathLength(points) / diagonal >= MIN_DETAIL))
      .sort((a, b) => pathLength(b) - pathLength(a))

  const outline = byRole('outline')
  const structure = byRole('structure')
  // Detal ma tyle miejsca, ile zostało po kształcie; najdłuższe detale mają pierwszeństwo.
  const detail = byRole('detail').slice(0, Math.max(0, MAX_STEPS - outline.length - structure.length))

  // Rysunek zaczyna się od góry obiektu — tak prowadzi się szkic postaci i przedmiotu.
  const all = [...outline, ...structure, ...detail]
  if (all.length === 0) return []
  let pen = all.flat().reduce((top, p) => (p.y < top.y ? p : top))

  const plan: PlannedContour[] = []
  for (const [role, group] of [['outline', outline], ['structure', structure], ['detail', detail]] as const) {
    const result = chain(group, pen)
    pen = result.pen
    for (const points of result.ordered) plan.push({ points, role })
  }
  return plan
}
