import type { Stroke } from '../types/drawing'
import { drawStroke } from '../features/canvas/utils/canvasDrawing'
import type { CanvasView } from '../features/canvas/utils/canvasPoint'
import { describeAiError, invokeAi } from './aiClient'

export type ImageGuideStep = {
  id: string
  title: string
  description: string
  /** Linie pomocnicze tego kroku, już we współrzędnych zdjęcia (piksele). */
  strokes: Stroke[]
}

/** Punkt z modelu: ułamek szerokości i wysokości zdjęcia. */
type NormalizedPoint = { x: number; y: number }

const GUIDE_BRUSH_SIZE = 6

/**
 * Model podaje linie w ułamkach rozmiaru zdjęcia (0–1), bo nie zna rozdzielczości pliku.
 * Tutaj skalujemy je do pikseli zdjęcia — tego samego układu, w którym płótno rysuje
 * tło i zapisuje kreski użytkownika, więc wszystko leży na sobie.
 */
export function guideStrokesFromNormalized(
  strokes: { points: NormalizedPoint[] }[] | undefined,
  imageWidth: number,
  imageHeight: number,
): Stroke[] {
  if (!strokes) return []
  return strokes
    .map((stroke) => ({
      brushSize: GUIDE_BRUSH_SIZE,
      points: (stroke.points ?? [])
        .filter((point) => Number.isFinite(point?.x) && Number.isFinite(point?.y))
        .map((point) => ({
          x: Math.min(1, Math.max(0, point.x)) * imageWidth,
          y: Math.min(1, Math.max(0, point.y)) * imageHeight,
          timestamp: 0,
        })),
    }))
    .filter((stroke) => stroke.points.length >= 2)
}

export type SupportedMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

// Edge Function zwraca kroki jako JSON zgodny ze schematem (structured outputs).
export async function generateImageSteps(
  imageBase64: string,
  mediaType: SupportedMediaType,
  imageWidth: number,
  imageHeight: number,
): Promise<ImageGuideStep[]> {
  const { steps } = await invokeAi<{
    steps: { title: string; description: string; strokes?: { points: NormalizedPoint[] }[] }[]
  }>({
    action: 'image-steps',
    image: { data: imageBase64, mediaType },
  })
  return steps.map((step, i) => ({
    id: `step-${i}`,
    title: step.title,
    description: step.description,
    strokes: guideStrokesFromNormalized(step.strokes, imageWidth, imageHeight),
  }))
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
