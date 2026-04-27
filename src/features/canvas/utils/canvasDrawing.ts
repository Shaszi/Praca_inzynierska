import type { Stroke } from '../../../types/drawing'

type DrawStrokeOptions = {
  color: string
  dpr: number
  alpha?: number
  lineWidthOverride?: number
}

type RenderSceneOptions = {
  context: CanvasRenderingContext2D
  width: number
  height: number
  dpr: number
  referenceStrokes: Stroke[]
  userStrokes: Stroke[]
  activeStroke: Stroke | null
  referenceStrokeColor: string
  userStrokeColor: string
}

function configureContext(
  context: CanvasRenderingContext2D,
  dpr: number,
  color: string,
  lineWidth: number,
  alpha: number,
): void {
  context.setTransform(dpr, 0, 0, dpr, 0, 0)
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.strokeStyle = color
  context.fillStyle = color
  context.lineWidth = lineWidth
  context.globalAlpha = alpha
}

export function drawStroke(
  context: CanvasRenderingContext2D,
  stroke: Stroke,
  options: DrawStrokeOptions,
): void {
  if (stroke.points.length === 0) {
    return
  }

  const lineWidth = options.lineWidthOverride ?? stroke.brushSize
  const alpha = options.alpha ?? 1

  configureContext(context, options.dpr, options.color, lineWidth, alpha)

  if (stroke.points.length === 1) {
    context.beginPath()
    context.arc(stroke.points[0].x, stroke.points[0].y, lineWidth / 2, 0, Math.PI * 2)
    context.fill()
    return
  }

  context.beginPath()
  context.moveTo(stroke.points[0].x, stroke.points[0].y)
  for (let index = 1; index < stroke.points.length; index += 1) {
    context.lineTo(stroke.points[index].x, stroke.points[index].y)
  }
  context.stroke()
}

export function renderCanvasScene({
  context,
  width,
  height,
  dpr,
  referenceStrokes,
  userStrokes,
  activeStroke,
  referenceStrokeColor,
  userStrokeColor,
}: RenderSceneOptions): void {
  context.clearRect(0, 0, width, height)

  for (const stroke of referenceStrokes) {
    drawStroke(context, stroke, {
      color: referenceStrokeColor,
      dpr,
      alpha: 0.9,
    })
  }

  for (const stroke of userStrokes) {
    drawStroke(context, stroke, {
      color: userStrokeColor,
      dpr,
    })
  }

  if (activeStroke) {
    drawStroke(context, activeStroke, {
      color: userStrokeColor,
      dpr,
    })
  }

  context.globalAlpha = 1
}