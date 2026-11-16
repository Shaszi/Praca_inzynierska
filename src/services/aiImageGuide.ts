import type { Stroke } from '../types/drawing'
import { extractContours, pathLength, SELECTION_EDGE_QUANTILE, type ContourPoint } from '../features/practice/contours'
import type { ContourRole } from '../features/practice/coursePlan'
import {
  assembleFromRegions,
  assembleParts,
  partsFromPlan,
  type FaceRegion,
  type PlannedStep,
} from '../features/practice/parts/assembleParts'
import { detectPerson } from '../features/practice/parts/detectPerson'
import { drawStroke } from '../features/canvas/utils/canvasDrawing'
import type { CanvasView } from '../features/canvas/utils/canvasPoint'
import { AiError, describeAiError, invokeAi } from './aiClient'
import { isolateSubject, maskContains, type SubjectMask } from '../features/practice/subjectMask'

export type ImageGuideStep = {
  id: string
  title: string
  description: string
  strokes: Stroke[]
  /** Część obrazka, do której należy krok (np. „Oko — lewa strona”). Starsze kursy jej nie mają. */
  part?: { id: string; name: string }
}

export type SupportedMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

const GUIDE_BRUSH_SIZE = 3

const toStroke = (points: ContourPoint[]): Stroke => ({
  brushSize: GUIDE_BRUSH_SIZE,
  points: points.map((point) => ({ x: point.x, y: point.y, timestamp: 0 })),
})

export async function buildContourCourse(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  imageBase64: string,
  mediaType: SupportedMediaType,
  image: HTMLImageElement,
  mask: SubjectMask | null = null,
): Promise<ImageGuideStep[]> {
  const isLasso = mask?.soft === true
  const source = mask && !isLasso ? isolateSubject(pixels, width, height, mask) : pixels

  const person = await detectPerson(image, width, height).catch((error) => {
    console.error(error)
    return null
  })
  const personSelected =
    person && (!mask || maskContains(mask, width, height)(Math.round(person.faceCenter.x), Math.round(person.faceCenter.y)))

  const keep = isLasso && mask ? maskContains(mask, width, height) : undefined
  let plan: PlannedStep[]
  if (personSelected) {
    plan = assembleParts({ pixels, width, height, face: person.face, categories: person.categories, selection: mask })
  } else {
    const base = partsFromPlan(
      extractContours(source, width, height, {
        ...(mask ? { edgeQuantile: SELECTION_EDGE_QUANTILE } : {}),
        ...(keep ? { keep } : {}),
      }),
      width,
      height,
      isLasso ? null : mask,
    )
    const inside = mask ? maskContains(mask, width, height) : null
    const regions = (
      await locateFaceRegions(imageBase64, mediaType, width, height).catch((error) => {
        console.error(error)
        return []
      })
    ).filter(({ box }) => !inside || inside(Math.round((box.minX + box.maxX) / 2), Math.round((box.minY + box.maxY) / 2)))
    plan = regions.length > 0 ? assembleFromRegions({ pixels: source, width, height, regions, base, keep }) : base
  }
  if (plan.length === 0) {
    throw new AiError('Nie znalazłem na tym zdjęciu wyraźnych konturów. Spróbuj zdjęcia z ostrzejszymi krawędziami.', 'no_contours')
  }

  const hasMask = mask !== null || Boolean(personSelected)
  const settled = await Promise.allSettled(
      groupForLabeling(plan, width, height).map(async ({ focus, indices, box }) => {
        const region = box ?? { x: 0, y: 0, w: width, h: height }
        const local = indices.map((i) => ({
          ...plan[i],
          points: plan[i].points.map((p) => ({ x: p.x - region.x, y: p.y - region.y })),
        }))
        const got = await labelContours(
          box ? renderRegion(pixels, width, height, box) : imageBase64,
          box ? 'image/jpeg' : mediaType,
          summarizeContours(local, region.w, region.h),
          renderNumberedContours(source, width, height, indices.map((i) => plan[i].points), box),
          hasMask,
          focus,
        )
        return got.flatMap((label) => (indices[label.i] === undefined ? [] : [{ ...label, i: indices[label.i] }]))
      }),
  )
  // Jedna nieudana grupa dostaje nazwy zapasowe; kurs przerywa dopiero brak wszystkich.
  const labels = settled.flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
  if (settled.every((result) => result.status === 'rejected')) throw (settled[0] as PromiseRejectedResult).reason
  const steps = buildSteps(plan, labels, hasMask)
  if (steps.length === 0) {
    throw new AiError('Nie udało się wybrać linii obiektu. Stuknij w obiekt na zdjęciu i spróbuj jeszcze raz.', 'no_contours')
  }
  return steps
}

const REGION_NAMES: Record<string, string> = {
  'brow-left': 'Brew — lewa strona',
  'brow-right': 'Brew — prawa strona',
  'eye-left': 'Oko — lewa strona',
  'eye-right': 'Oko — prawa strona',
  nose: 'Nos',
  mouth: 'Usta',
  'hair-strands': 'Kosmyki włosów',
}
const REGION_ORDER = Object.keys(REGION_NAMES)
// Ramki od modelu są przybliżone — zapas, żeby nie uciąć kącika oka czy rzęs.
const REGION_GROW = 0.3
const REGION_MIN_PX = 12

type LocatedPart = { kind: string; x0: number; y0: number; x1: number; y1: number }

export function regionsFromLocated(parts: LocatedPart[], width: number, height: number): FaceRegion[] {
  return parts
    .filter((part) => Object.hasOwn(REGION_NAMES, part.kind))
    .sort((a, b) => REGION_ORDER.indexOf(a.kind) - REGION_ORDER.indexOf(b.kind))
    .map((part) => {
      const padX = Math.max(REGION_MIN_PX, (part.x1 - part.x0) * width * REGION_GROW)
      const padY = Math.max(REGION_MIN_PX, (part.y1 - part.y0) * height * REGION_GROW)
      return {
        id: part.kind,
        name: REGION_NAMES[part.kind],
        box: {
          minX: Math.max(0, Math.floor(part.x0 * width - padX)),
          minY: Math.max(0, Math.floor(part.y0 * height - padY)),
          maxX: Math.min(width, Math.ceil(part.x1 * width + padX)),
          maxY: Math.min(height, Math.ceil(part.y1 * height + padY)),
        },
      }
    })
}

export async function locateFaceRegions(
  imageBase64: string,
  mediaType: SupportedMediaType,
  width: number,
  height: number,
): Promise<FaceRegion[]> {
  const { parts } = await invokeAi<{ parts: LocatedPart[] }>({
    action: 'locate-parts',
    image: { data: imageBase64, mediaType },
  })
  return regionsFromLocated(parts, width, height)
}

export type ContourLabel = { i: number; title: string; description: string; background: boolean }

const FALLBACK: Record<ContourRole, { title: string; description: string }> = {
  outline: { title: 'Obrys sylwetki', description: 'Poprowadź linię po krawędzi obiektu jednym, spokojnym ruchem.' },
  structure: { title: 'Główna linia', description: 'Długa linia, która buduje kształt — rysuj ją z łokcia.' },
  detail: { title: 'Detal', description: 'Krótka linia detalu — lekko, z nadgarstka.' },
}

export function buildSteps(plan: PlannedStep[], labels: ContourLabel[], hasMask: boolean): ImageGuideStep[] {
  const byIndex = new Map(labels.map((label) => [label.i, label]))
  const steps: ImageGuideStep[] = []
  plan.forEach((contour, i) => {
    const label = byIndex.get(i)
    if (!hasMask && label?.background) return
    steps.push({
      id: `step-${steps.length}`,
      title: label?.title.trim() || contour.part.name || FALLBACK[contour.role].title,
      description: label?.description.trim() || FALLBACK[contour.role].description,
      strokes: [toStroke(contour.points)],
      part: contour.part,
    })
  })
  return steps
}

export type ContourSummary = {
  i: number
  box: [number, number, number, number]
  len: number
  closed: boolean
  role: ContourRole
  part: string
}

export function summarizeContours(plan: PlannedStep[], width: number, height: number): ContourSummary[] {
  const diagonal = Math.hypot(width, height)
  return plan.map(({ points, role, part }, i) => {
    const xs = points.map((p) => p.x)
    const ys = points.map((p) => p.y)
    const first = points[0]
    const last = points[points.length - 1]
    return {
      i,
      box: [Math.min(...xs) / width, Math.min(...ys) / height, Math.max(...xs) / width, Math.max(...ys) / height],
      len: pathLength(points) / diagonal,
      closed: Math.hypot(last.x - first.x, last.y - first.y) < 0.15 * pathLength(points),
      role,
      part: part.name,
    }
  })
}

export async function labelContours(
  imageBase64: string,
  mediaType: SupportedMediaType,
  contours: ContourSummary[],
  overlayBase64: string,
  hasMask: boolean,
  focus: LabelFocus | null = null,
): Promise<ContourLabel[]> {
  const { labels } = await invokeAi<{ labels: ContourLabel[] }>({
    action: 'plan-contours',
    image: { data: imageBase64, mediaType },
    overlay: { data: overlayBase64, mediaType: 'image/jpeg' },
    contours,
    hasMask,
    ...(focus ? { focus } : {}),
  })
  return labels
}

export type LabelFocus = 'eyes' | 'face' | 'hair'
export type Region = { x: number; y: number; w: number; h: number }
export type LabelGroup = { focus: LabelFocus | null; indices: number[]; box: Region | null }

const FACE_IDS = ['jaw', 'forehead', 'nose', 'mouth']

function focusOf(partId: string): LabelFocus | null {
  if (/^(eye|iris|brow)-/.test(partId)) return 'eyes'
  if (FACE_IDS.includes(partId)) return 'face'
  if (partId.startsWith('hair-')) return 'hair'
  return null
}

const FOCUS_PADDING = 0.25
const FOCUS_MIN_PX = 64

/**
 * Oczy, twarz i włosy AI nazywa osobno, na powiększonym wycinku — w jednym zapytaniu z całym
 * zdjęciem drobne linie oczu ginęły wśród kilkudziesięciu kosmyków.
 */
export function groupForLabeling(plan: PlannedStep[], width: number, height: number): LabelGroup[] {
  const groups = new Map<LabelFocus | null, number[]>()
  plan.forEach((step, i) => {
    const focus = focusOf(step.part.id)
    groups.set(focus, [...(groups.get(focus) ?? []), i])
  })
  return [...groups].map(([focus, indices]) => {
    if (!focus) return { focus, indices, box: null }
    const points = indices.flatMap((i) => plan[i].points)
    const minX = Math.min(...points.map((p) => p.x))
    const maxX = Math.max(...points.map((p) => p.x))
    const minY = Math.min(...points.map((p) => p.y))
    const maxY = Math.max(...points.map((p) => p.y))
    const span = Math.max(maxX - minX, maxY - minY)
    const pad = Math.max(FOCUS_PADDING * span, (FOCUS_MIN_PX - span) / 2)
    const x = Math.max(0, Math.floor(minX - pad))
    const y = Math.max(0, Math.floor(minY - pad))
    return {
      focus,
      indices,
      box: { x, y, w: Math.min(width, Math.ceil(maxX + pad)) - x, h: Math.min(height, Math.ceil(maxY + pad)) - y },
    }
  })
}

const OVERLAY_MAX = 1024
const MAX_UPSCALE = 4
const OVERLAY_COLORS = ['#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#0aa5a5', '#d6249f', '#808000']

function drawRegion(pixels: Uint8ClampedArray, width: number, height: number, box: Region | null) {
  const full = document.createElement('canvas')
  full.width = width
  full.height = height
  full.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(pixels), width, height), 0, 0)

  const region = box ?? { x: 0, y: 0, w: width, h: height }
  const scale = Math.min(box ? MAX_UPSCALE : 1, OVERLAY_MAX / Math.max(region.w, region.h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(region.w * scale)
  canvas.height = Math.round(region.h * scale)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(full, region.x, region.y, region.w, region.h, 0, 0, canvas.width, canvas.height)
  return { canvas, ctx, scale, region }
}

export function renderRegion(pixels: Uint8ClampedArray, width: number, height: number, box: Region): string {
  return drawRegion(pixels, width, height, box).canvas.toDataURL('image/jpeg', 0.85).split(',')[1]
}

export function renderNumberedContours(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  contours: ContourPoint[][],
  box: Region | null = null,
): string {
  const { canvas, ctx, scale, region } = drawRegion(pixels, width, height, box)
  const sx = (p: ContourPoint) => (p.x - region.x) * scale
  const sy = (p: ContourPoint) => (p.y - region.y) * scale
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.lineWidth = 2.5
  ctx.lineJoin = 'round'
  ctx.font = 'bold 15px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  contours.forEach((points, i) => {
    const color = OVERLAY_COLORS[i % OVERLAY_COLORS.length]
    ctx.strokeStyle = color
    ctx.beginPath()
    points.forEach((p, j) => (j === 0 ? ctx.moveTo(sx(p), sy(p)) : ctx.lineTo(sx(p), sy(p))))
    ctx.stroke()

    const mid = points[Math.floor(points.length / 2)]
    ctx.lineWidth = 4
    ctx.strokeStyle = '#ffffff'
    ctx.strokeText(String(i), sx(mid), sy(mid))
    ctx.fillStyle = color
    ctx.fillText(String(i), sx(mid), sy(mid))
    ctx.lineWidth = 2.5
  })

  return canvas.toDataURL('image/jpeg', 0.85).split(',')[1]
}

export function readImageSize(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
    image.onerror = () => reject(new Error('Nie udało się odczytać rozmiaru zdjęcia.'))
    image.src = url
  })
}

const SIZE = 512
const PADDING = 24
const DONE_COLOR = '#b4b7bd'
const NEW_COLOR = '#111827'

export function fitStrokesToSquare(strokes: Stroke[], size = SIZE, padding = PADDING): CanvasView {
  const points = strokes.flatMap((stroke) => stroke.points)
  if (points.length === 0) return { scale: 1, offsetX: 0, offsetY: 0 }

  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const width = Math.max(Math.max(...xs) - minX, 1)
  const height = Math.max(Math.max(...ys) - minY, 1)
  const scale = (size - padding * 2) / Math.max(width, height)

  return {
    scale,
    offsetX: (size - width * scale) / 2 - minX * scale,
    offsetY: (size - height * scale) / 2 - minY * scale,
  }
}

function renderUserDrawingToBase64(doneStrokes: Stroke[], stepStrokes: Stroke[]): string {
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, SIZE, SIZE)

  const view = fitStrokesToSquare([...doneStrokes, ...stepStrokes])
  for (const stroke of doneStrokes) drawStroke(ctx, stroke, { color: DONE_COLOR, dpr: 1, view })
  for (const stroke of stepStrokes) drawStroke(ctx, stroke, { color: NEW_COLOR, dpr: 1, view })
  ctx.globalAlpha = 1

  return canvas.toDataURL('image/png').split(',')[1]
}

export async function analyzeStrokeAgainstImage(
  doneStrokes: Stroke[],
  stepStrokes: Stroke[],
  referenceImageBase64: string,
  referenceMediaType: SupportedMediaType,
  stepTitle: string,
  stepDescription: string,
): Promise<string> {
  try {
    const { text } = await invokeAi<{ text: string }>({
      action: 'analyze-image-step',
      referenceImage: { data: referenceImageBase64, mediaType: referenceMediaType },
      drawingImage: renderUserDrawingToBase64(doneStrokes, stepStrokes),
      stepTitle,
      stepDescription,
    })
    return text || 'Analiza niedostępna.'
  } catch (error) {
    return describeAiError(error)
  }
}
