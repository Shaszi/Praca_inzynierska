import {
  densify,
  extractContours,
  pathLength,
  removeOverlapsInOrder,
  SELECTION_EDGE_QUANTILE,
  simplify,
  type ContourPoint,
} from '../contours'
import { chain, planCourse, type ContourRole } from '../coursePlan'
import type { SubjectMask } from '../subjectMask'
import type { Part } from './faceParts'

/** Mapa kategorii z segmentacji osoby (selfie_multiclass): wartość na piksel w rozdzielczości maski. */
export type CategoryMask = { data: Uint8Array; width: number; height: number }

export const CATEGORY = { background: 0, hair: 1, bodySkin: 2, faceSkin: 3, clothes: 4, accessories: 5 } as const

export type PlannedStep = { points: ContourPoint[]; part: { id: string; name: string }; role: ContourRole }

const MAX_STRANDS = 70
const MAX_CLOTHES = 10
// Twarz i włosy mają być szczegółowe: niższy próg krawędzi i krótsze linie niż reszta.
const DETAIL_EDGE_QUANTILE = 0.15

/** Obszar wokół rysu twarzy, w którym szukamy detali (powieka, załamanie, rzęsy, nozdrza). */
const FEATURE_DETAIL: Record<string, { grow: [number, number]; cap: number }> = {
  'eye-left': { grow: [1.5, 3.2], cap: 14 },
  'eye-right': { grow: [1.5, 3.2], cap: 14 },
  'brow-left': { grow: [1.3, 2.6], cap: 6 },
  'brow-right': { grow: [1.3, 2.6], cap: 6 },
  nose: { grow: [1.7, 1.3], cap: 10 },
  mouth: { grow: [1.4, 2.2], cap: 12 },
}

export type Box = { minX: number; minY: number; maxX: number; maxY: number }

function boxOf(lines: ContourPoint[][], grow: [number, number], width: number, height: number): Box {
  const points = lines.flat()
  const minX = Math.min(...points.map((p) => p.x))
  const maxX = Math.max(...points.map((p) => p.x))
  const minY = Math.min(...points.map((p) => p.y))
  const maxY = Math.max(...points.map((p) => p.y))
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const hw = Math.max(8, ((maxX - minX) / 2) * grow[0])
  const hh = Math.max(8, ((maxY - minY) / 2) * grow[1])
  return {
    minX: Math.max(0, Math.floor(cx - hw)),
    minY: Math.max(0, Math.floor(cy - hh)),
    maxX: Math.min(width, Math.ceil(cx + hw)),
    maxY: Math.min(height, Math.ceil(cy + hh)),
  }
}

/** Kontury tylko z wycinka zdjęcia — szybciej niż cały obraz z filtrem `keep`. */
function contoursInBox(
  pixels: Uint8ClampedArray,
  width: number,
  box: Box,
  options: { keep?: (x: number, y: number) => boolean; minLengthPx: number },
): ContourPoint[][] {
  const w = box.maxX - box.minX
  const h = box.maxY - box.minY
  if (w < 8 || h < 8) return []
  const crop = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    const from = ((box.minY + y) * width + box.minX) * 4
    crop.set(pixels.subarray(from, from + w * 4), y * w * 4)
  }
  const keep = options.keep
  return extractContours(crop, w, h, {
    edgeQuantile: DETAIL_EDGE_QUANTILE,
    minLengthPx: options.minLengthPx,
    minGapPx: 3,
    ...(keep ? { keep: (x: number, y: number) => keep(x + box.minX, y + box.minY) } : {}),
  }).map((line) => line.map((p) => ({ x: p.x + box.minX, y: p.y + box.minY })))
}

function inCategory(mask: CategoryMask, width: number, height: number, accept: (value: number) => boolean) {
  return (x: number, y: number) => {
    const mx = Math.min(mask.width - 1, Math.floor((x * mask.width) / width))
    const my = Math.min(mask.height - 1, Math.floor((y * mask.height) / height))
    return accept(mask.data[my * mask.width + mx])
  }
}

/** Obrys obszaru maski: maska jako czarno-biały obraz, a z niego zwykłe kontury. */
function regionOutline(mask: CategoryMask, accept: (value: number) => boolean, width: number, height: number) {
  const rgba = new Uint8ClampedArray(mask.width * mask.height * 4)
  for (let i = 0; i < mask.data.length; i++) {
    const v = accept(mask.data[i]) ? 255 : 0
    rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = v
    rgba[i * 4 + 3] = 255
  }
  const sx = width / mask.width
  const sy = height / mask.height
  return extractContours(rgba, mask.width, mask.height, { minGapPx: 1 })
    .slice(0, 3)
    .map((line) => line.map((p) => ({ x: p.x * sx, y: p.y * sy })))
}

const share = (line: ContourPoint[], inside: (x: number, y: number) => boolean) =>
  line.filter((p) => inside(Math.round(p.x), Math.round(p.y))).length / Math.max(1, line.length)

type Candidate = { part: Part; role: ContourRole; priority: number; minLength: number }

/**
 * Kurs z części. Kolejność rysowania: szczęka, zarys włosów, czoło, rysy twarzy, kosmyki,
 * sylwetka, ubranie. Dublujące się linie usuwa pierwszeństwo: punkty twarzy są dokładne,
 * więc wygrywają z krawędziami wykrytymi ze zdjęcia.
 */
export function assembleParts(input: {
  pixels: Uint8ClampedArray
  width: number
  height: number
  face: Part[]
  categories: CategoryMask | null
  selection: SubjectMask | null
}): PlannedStep[] {
  const { pixels, width, height, face, categories } = input
  const diagonal = Math.hypot(width, height)
  const minGap = Math.max(3, diagonal * 0.0012)
  const shortDetail = Math.max(6, diagonal * 0.003)
  const byId = new Map(face.map((part) => [part.id, part]))
  const facePart = (id: string) => byId.get(id)

  const candidates: Candidate[] = []
  const add = (part: Part | undefined, role: ContourRole, priority: number, minLength = diagonal * 0.01) => {
    if (part && part.contours.length > 0) candidates.push({ part, role, priority, minLength })
  }

  const hair = categories ? inCategory(categories, width, height, (v) => v === CATEGORY.hair) : null
  const forehead = facePart('forehead')
  const foreheadHidden = forehead && hair ? share(forehead.contours[0], hair) > 0.5 : false

  add(facePart('jaw'), 'outline', 1)
  if (categories) {
    add({ id: 'hair-outline', name: 'Zarys włosów', contours: regionOutline(categories, (v) => v === CATEGORY.hair, width, height) }, 'outline', 2)
  }
  if (!foreheadHidden) add(forehead, 'outline', 1)
  for (const id of ['brow-left', 'brow-right', 'eye-left', 'eye-right', 'iris-left', 'iris-right', 'nose', 'mouth']) {
    const part = facePart(id)
    add(part, 'structure', 0, shortDetail)
    const detail = FEATURE_DETAIL[id]
    if (part && detail) {
      const extra = contoursInBox(pixels, width, boxOf(part.contours, detail.grow, width, height), {
        minLengthPx: shortDetail,
      }).slice(0, detail.cap)
      add({ ...part, contours: extra }, 'detail', 0.5, shortDetail)
    }
  }

  if (categories && hair) {
    const hairOutline = candidates.find((candidate) => candidate.part.id === 'hair-outline')?.part.contours ?? []
    const strands = (
      hairOutline.length > 0
        ? contoursInBox(pixels, width, boxOf(hairOutline, [1.05, 1.05], width, height), { keep: hair, minLengthPx: shortDetail })
        : []
    )
      .filter((line) => pathLength(line) / diagonal >= 0.008)
      .slice(0, MAX_STRANDS)
    add({ id: 'hair-strands', name: 'Kosmyki włosów', contours: strands }, 'detail', 4, diagonal * 0.008)

    add(
      { id: 'silhouette', name: 'Szyja i ramiona', contours: regionOutline(categories, (v) => v !== CATEGORY.background, width, height) },
      'outline',
      3,
    )
    const clothes = inCategory(categories, width, height, (v) => v === CATEGORY.clothes)
    const folds = extractContours(pixels, width, height, { keep: clothes, edgeQuantile: SELECTION_EDGE_QUANTILE })
      .filter((line) => pathLength(line) / diagonal >= 0.03)
      .slice(0, MAX_CLOTHES)
    add({ id: 'clothes', name: 'Ubranie', contours: folds }, 'detail', 5)
  }

  return orderCandidates(candidates, width, height, minGap, shortDetail)
}

/** Usuwa dublujące się linie według priorytetu i układa kroki w kolejności kandydatów. */
function orderCandidates(candidates: Candidate[], width: number, height: number, minGap: number, shortDetail: number): PlannedStep[] {
  const lines = candidates.flatMap((candidate, c) =>
    candidate.part.contours.map((points) => ({ c, points: densify(points) })),
  )
  const order = lines.map((_, i) => i).sort((a, b) => candidates[lines[a].c].priority - candidates[lines[b].c].priority)
  const kept = removeOverlapsInOrder(order.map((i) => lines[i].points), width, height, minGap, shortDetail)
  const keptByCandidate = candidates.map(() => [] as ContourPoint[][])
  for (const run of kept) {
    const c = lines[order[run.source]].c
    if (pathLength(run.points) >= candidates[c].minLength) keptByCandidate[c].push(simplify(run.points, 1.2))
  }

  const steps: PlannedStep[] = []
  let pen: ContourPoint = { x: width / 2, y: 0 }
  candidates.forEach((candidate, c) => {
    const result = chain(keptByCandidate[c], pen)
    pen = result.pen
    for (const points of result.ordered) {
      steps.push({ points, part: { id: candidate.part.id, name: candidate.part.name }, role: candidate.role })
    }
  })
  return steps
}

const ROLE_PART: Record<ContourRole, { id: string; name: string }> = {
  outline: { id: 'outline', name: 'Obrys' },
  structure: { id: 'structure', name: 'Konstrukcja' },
  detail: { id: 'detail', name: 'Detale' },
}

/** Bez twarzy na zdjęciu: dotychczasowy plan, pogrupowany w części według roli linii. */
export function partsFromPlan(contours: ContourPoint[][], width: number, height: number, mask: SubjectMask | null): PlannedStep[] {
  return planCourse(contours, width, height, mask).map((step) => ({ ...step, part: ROLE_PART[step.role] }))
}

export type FaceRegion = { id: string; name: string; box: Box }

const REGION_CAP: Record<string, number> = {
  'brow-left': 8,
  'brow-right': 8,
  'eye-left': 20,
  'eye-right': 20,
  nose: 12,
  mouth: 14,
  'hair-strands': MAX_STRANDS,
}

/**
 * Twarz, której MediaPipe nie wykrył (rysunek, zwierzę, profil): ramki rysów wskazuje AI,
 * a linie w nich szukamy dokładniej niż w reszcie zdjęcia. Rysy wygrywają z liniami planu.
 */
export function assembleFromRegions(input: {
  pixels: Uint8ClampedArray
  width: number
  height: number
  regions: FaceRegion[]
  base: PlannedStep[]
  keep?: (x: number, y: number) => boolean
}): PlannedStep[] {
  const { pixels, width, height, regions, base, keep } = input
  const diagonal = Math.hypot(width, height)
  const minGap = Math.max(3, diagonal * 0.0012)
  const shortDetail = Math.max(6, diagonal * 0.003)

  const fromBase = (role: ContourRole, priority: number): Candidate => ({
    part: { ...ROLE_PART[role], contours: base.filter((step) => step.role === role).map((step) => step.points) },
    role,
    priority,
    minLength: diagonal * 0.01,
  })
  const features = regions.map((region): Candidate => {
    const hair = region.id === 'hair-strands'
    const contours = contoursInBox(pixels, width, region.box, { keep, minLengthPx: shortDetail })
      .filter((line) => !hair || pathLength(line) / diagonal >= 0.008)
      .slice(0, REGION_CAP[region.id] ?? 10)
    return { part: { id: region.id, name: region.name, contours }, role: hair ? 'detail' : 'structure', priority: hair ? 4 : 0, minLength: shortDetail }
  })

  return orderCandidates(
    [fromBase('outline', 2), ...features, fromBase('structure', 3), fromBase('detail', 5)].filter(
      (candidate) => candidate.part.contours.length > 0,
    ),
    width,
    height,
    minGap,
    shortDetail,
  )
}
