import type { Stroke } from '../types/drawing'
import { extractContours, pathLength, type ContourPoint } from '../features/practice/contours'
import { drawStroke } from '../features/canvas/utils/canvasDrawing'
import type { CanvasView } from '../features/canvas/utils/canvasPoint'
import { AiError, describeAiError, invokeAi } from './aiClient'

export type ImageGuideStep = {
  id: string
  title: string
  description: string
  /** Kontury tego kroku, we współrzędnych pikselowych zdjęcia. */
  strokes: Stroke[]
}

export type SupportedMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

const GUIDE_BRUSH_SIZE = 6

const toStroke = (points: ContourPoint[]): Stroke => ({
  brushSize: GUIDE_BRUSH_SIZE,
  // Wzorzec nie niesie czasu: ocena bierze z niego kształt, tempo liczy z kreski użytkownika.
  points: points.map((point) => ({ x: point.x, y: point.y, timestamp: 0 })),
})

/**
 * Kurs rysowania z wgranego zdjęcia: kontury liczy przeglądarka z pikseli, model układa
 * je w kroki i nazywa. Dzięki temu linia, po której użytkownik prowadzi rękę, leży
 * na obiekcie co do piksela — model nie dotyka geometrii.
 */
export async function buildContourCourse(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  imageBase64: string,
  mediaType: SupportedMediaType,
): Promise<ImageGuideStep[]> {
  const contours = extractContours(pixels, width, height)
  if (contours.length === 0) {
    throw new AiError('Nie znalazłem na tym zdjęciu wyraźnych konturów. Spróbuj zdjęcia z ostrzejszymi krawędziami.', 'no_contours')
  }

  const plan = await planContourSteps(imageBase64, mediaType, summarizeContours(contours, width, height))
  return splitToSingleContourSteps(plan, contours)
}

/**
 * Jeden krok = jedna linia. Model czasem wrzuca kilka konturów do kroku, a wtedy ocena
 * kreski nie ma czego porównywać: mierzy pierwszy kontur, choć narysować trzeba wszystkie.
 * Zamiast ratować to w ocenie, rozkładamy krok na tyle kroków, ile ma linii — numer
 * w tytule mówi, że to dalszy ciąg tej samej rzeczy.
 */
export function splitToSingleContourSteps(
  plan: ContourStepPlan[],
  contours: ContourPoint[][],
): ImageGuideStep[] {
  const steps: ImageGuideStep[] = []
  for (const planned of plan) {
    const usable = planned.contours.filter((index) => contours[index]?.length >= 2)
    usable.forEach((index, position) => {
      steps.push({
        id: `step-${steps.length}`,
        title: usable.length > 1 ? `${planned.title} (${position + 1} z ${usable.length})` : planned.title,
        description: planned.description,
        strokes: [toStroke(contours[index])],
      })
    })
  }
  return steps
}

/**
 * Opis konturu dla modelu. Model dostaje tylko to — gdzie kontur leży i jak jest długi —
 * i odsyła numery pogrupowane w kroki. Punkty zostają na kliencie, bo pochodzą z pikseli
 * zdjęcia i są dokładne; model myliłby się o kilkanaście procent kadru.
 */
export type ContourSummary = {
  i: number
  box: [number, number, number, number]
  len: number
  closed: boolean
}

export function summarizeContours(
  contours: ContourPoint[][],
  width: number,
  height: number,
): ContourSummary[] {
  const diagonal = Math.hypot(width, height)
  return contours.map((points, i) => {
    const xs = points.map((p) => p.x)
    const ys = points.map((p) => p.y)
    const first = points[0]
    const last = points[points.length - 1]
    return {
      i,
      box: [Math.min(...xs) / width, Math.min(...ys) / height, Math.max(...xs) / width, Math.max(...ys) / height],
      len: pathLength(points) / diagonal,
      // Domknięty = koniec wraca w pobliże początku, w skali własnej długości konturu.
      closed: Math.hypot(last.x - first.x, last.y - first.y) < 0.15 * pathLength(points),
    }
  })
}

/** Krok kursu: nazwa od modelu, geometria ze zdjęcia. */
export type ContourStepPlan = { title: string; description: string; contours: number[] }

export async function planContourSteps(
  imageBase64: string,
  mediaType: SupportedMediaType,
  contours: ContourSummary[],
): Promise<ContourStepPlan[]> {
  const { steps } = await invokeAi<{ steps: ContourStepPlan[] }>({
    action: 'plan-contours',
    image: { data: imageBase64, mediaType },
    contours,
  })
  return steps
}

/** Rozmiar własny pliku — w tych pikselach liczymy linie pomocnicze i rysujemy tło. */
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
/** Wcześniejsze kroki — szare, żeby model widział kontekst i nie oceniał ich po raz drugi. */
const DONE_COLOR = '#b4b7bd'
const NEW_COLOR = '#111827'

/**
 * Dopasowanie obrysu kresek do kwadratu, jak w `StrokeThumbnail`. Bez tego punkty idą
 * w surowych współrzędnych płótna i wszystko poza lewym górnym kwadratem 512×512
 * jest wycinane z obrazka — model opisywał wtedy kreski, których nie widzi.
 */
export function fitStrokesToSquare(strokes: Stroke[], size = SIZE, padding = PADDING): CanvasView {
  const points = strokes.flatMap((stroke) => stroke.points)
  if (points.length === 0) return { scale: 1, offsetX: 0, offsetY: 0 }

  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const width = Math.max(Math.max(...xs) - minX, 1)
  const height = Math.max(Math.max(...ys) - minY, 1)
  // Jedna skala dla obu osi — inaczej rysunek byłby rozciągnięty i kąty przestałyby się zgadzać.
  const scale = (size - padding * 2) / Math.max(width, height)

  return {
    scale,
    offsetX: (size - width * scale) / 2 - minX * scale,
    offsetY: (size - height * scale) / 2 - minY * scale,
  }
}

/** Nowa kreska na czarno, poprzednie na szaro — inaczej model musiał zgadywać, co oceniać. */
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
