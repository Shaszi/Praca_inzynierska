import type { Stroke } from '../types/drawing'
import { drawStroke } from '../features/canvas/utils/canvasDrawing'
import type { CanvasView } from '../features/canvas/utils/canvasPoint'
import { describeAiError, invokeAi } from './aiClient'

export type ImageGuideStep = {
  id: string
  title: string
  description: string
}

export type SupportedMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

// Edge Function zwraca kroki jako JSON zgodny ze schematem (structured outputs).
export async function generateImageSteps(
  imageBase64: string,
  mediaType: SupportedMediaType,
): Promise<ImageGuideStep[]> {
  const { steps } = await invokeAi<{ steps: { title: string; description: string }[] }>({
    action: 'image-steps',
    image: { data: imageBase64, mediaType },
  })
  return steps.map((step, i) => ({ id: `step-${i}`, title: step.title, description: step.description }))
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
