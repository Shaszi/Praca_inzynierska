import type { Stroke } from '../types/drawing'
import { extractContours, pathLength, type ContourPoint } from '../features/practice/contours'
import { planCourse, type ContourRole, type PlannedContour } from '../features/practice/coursePlan'
import { drawStroke } from '../features/canvas/utils/canvasDrawing'
import type { CanvasView } from '../features/canvas/utils/canvasPoint'
import { AiError, describeAiError, invokeAi } from './aiClient'
import { isolateSubject, maskContains, type SubjectMask } from '../features/practice/subjectMask'

export type ImageGuideStep = {
  id: string
  title: string
  description: string
  strokes: Stroke[]
}

export type SupportedMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

const GUIDE_BRUSH_SIZE = 6

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
  mask: SubjectMask | null = null,
): Promise<ImageGuideStep[]> {
  const isLasso = mask?.soft === true
  const source = mask && !isLasso ? isolateSubject(pixels, width, height, mask) : pixels
  const contours = extractContours(source, width, height, isLasso && mask ? { keep: maskContains(mask, width, height) } : {})
  const plan = planCourse(contours, width, height, isLasso ? null : mask)
  if (plan.length === 0) {
    throw new AiError('Nie znalazłem na tym zdjęciu wyraźnych konturów. Spróbuj zdjęcia z ostrzejszymi krawędziami.', 'no_contours')
  }

  const labels = await labelContours(
    imageBase64,
    mediaType,
    summarizeContours(plan, width, height),
    renderNumberedContours(source, width, height, plan.map((step) => step.points)),
    mask !== null,
  )
  const steps = buildSteps(plan, labels, mask !== null)
  if (steps.length === 0) {
    throw new AiError('Nie udało się wybrać linii obiektu. Stuknij w obiekt na zdjęciu i spróbuj jeszcze raz.', 'no_contours')
  }
  return steps
}

export type ContourLabel = { i: number; title: string; description: string; background: boolean }

const FALLBACK: Record<ContourRole, { title: string; description: string }> = {
  outline: { title: 'Obrys sylwetki', description: 'Poprowadź linię po krawędzi obiektu jednym, spokojnym ruchem.' },
  structure: { title: 'Główna linia', description: 'Długa linia, która buduje kształt — rysuj ją z łokcia.' },
  detail: { title: 'Detal', description: 'Krótka linia detalu — lekko, z nadgarstka.' },
}

export function buildSteps(plan: PlannedContour[], labels: ContourLabel[], hasMask: boolean): ImageGuideStep[] {
  const byIndex = new Map(labels.map((label) => [label.i, label]))
  const steps: ImageGuideStep[] = []
  plan.forEach((contour, i) => {
    const label = byIndex.get(i)
    if (!hasMask && label?.background) return
    steps.push({
      id: `step-${steps.length}`,
      title: label?.title.trim() || FALLBACK[contour.role].title,
      description: label?.description.trim() || FALLBACK[contour.role].description,
      strokes: [toStroke(contour.points)],
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
}

export function summarizeContours(plan: PlannedContour[], width: number, height: number): ContourSummary[] {
  const diagonal = Math.hypot(width, height)
  return plan.map(({ points, role }, i) => {
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
    }
  })
}

export async function labelContours(
  imageBase64: string,
  mediaType: SupportedMediaType,
  contours: ContourSummary[],
  overlayBase64: string,
  hasMask: boolean,
): Promise<ContourLabel[]> {
  const { labels } = await invokeAi<{ labels: ContourLabel[] }>({
    action: 'plan-contours',
    image: { data: imageBase64, mediaType },
    overlay: { data: overlayBase64, mediaType: 'image/jpeg' },
    contours,
    hasMask,
  })
  return labels
}

const OVERLAY_MAX = 1024
const OVERLAY_COLORS = ['#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#0aa5a5', '#d6249f', '#808000']

export function renderNumberedContours(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  contours: ContourPoint[][],
): string {
  const full = document.createElement('canvas')
  full.width = width
  full.height = height
  full.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(pixels), width, height), 0, 0)

  const scale = Math.min(1, OVERLAY_MAX / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(full, 0, 0, canvas.width, canvas.height)
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
    points.forEach((p, j) => (j === 0 ? ctx.moveTo(p.x * scale, p.y * scale) : ctx.lineTo(p.x * scale, p.y * scale)))
    ctx.stroke()

    const mid = points[Math.floor(points.length / 2)]
    ctx.lineWidth = 4
    ctx.strokeStyle = '#ffffff'
    ctx.strokeText(String(i), mid.x * scale, mid.y * scale)
    ctx.fillStyle = color
    ctx.fillText(String(i), mid.x * scale, mid.y * scale)
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

function renderUserDrawingToBase64(doneStrokes: Stroke[], newStroke: Stroke): string {
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, SIZE, SIZE)

  const view = fitStrokesToSquare([...doneStrokes, newStroke])
  for (const stroke of doneStrokes) drawStroke(ctx, stroke, { color: DONE_COLOR, dpr: 1, view })
  drawStroke(ctx, newStroke, { color: NEW_COLOR, dpr: 1, view })
  ctx.globalAlpha = 1

  return canvas.toDataURL('image/png').split(',')[1]
}

export async function analyzeStrokeAgainstImage(
  doneStrokes: Stroke[],
  newStroke: Stroke,
  referenceImageBase64: string,
  referenceMediaType: SupportedMediaType,
  stepTitle: string,
  stepDescription: string,
): Promise<string> {
  try {
    const { text } = await invokeAi<{ text: string }>({
      action: 'analyze-image-step',
      referenceImage: { data: referenceImageBase64, mediaType: referenceMediaType },
      drawingImage: renderUserDrawingToBase64(doneStrokes, newStroke),
      stepTitle,
      stepDescription,
    })
    return text || 'Analiza niedostępna.'
  } catch (error) {
    return describeAiError(error)
  }
}
