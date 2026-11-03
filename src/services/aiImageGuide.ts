import type { Stroke } from '../types/drawing'
import { drawStroke } from '../features/canvas/utils/canvasDrawing'
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

function renderUserDrawingToBase64(strokes: Stroke[]): string {
  const SIZE = 512
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, SIZE, SIZE)

  for (const stroke of strokes) {
    drawStroke(ctx, stroke, { color: '#111827', dpr: 1 })
  }
  ctx.globalAlpha = 1

  return canvas.toDataURL('image/png').split(',')[1]
}

export async function analyzeStrokeAgainstImage(
  userStrokes: Stroke[],
  referenceImageBase64: string,
  referenceMediaType: SupportedMediaType,
  stepTitle: string,
  stepDescription: string,
): Promise<string> {
  try {
    const { text } = await invokeAi<{ text: string }>({
      action: 'analyze-image-step',
      referenceImage: { data: referenceImageBase64, mediaType: referenceMediaType },
      drawingImage: renderUserDrawingToBase64(userStrokes),
      stepTitle,
      stepDescription,
    })
    return text || 'Analiza niedostępna.'
  } catch (error) {
    return describeAiError(error)
  }
}
