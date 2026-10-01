import type { Stroke } from '../../../types/drawing'

type DrawStrokeOptions = {
  color: string
  dpr: number
  alpha?: number
  lineWidthOverride?: number
  dashPattern?: number[]
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
  context.setLineDash([])
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
  if (options.dashPattern) {
    context.setLineDash(options.dashPattern)
  }

  const points = stroke.points

  if (points.length === 1) {
    context.beginPath()
    context.arc(points[0].x, points[0].y, lineWidth / 2, 0, Math.PI * 2)
    context.fill()
    return
  }

  context.beginPath()
  context.moveTo(points[0].x, points[0].y)

  if (points.length === 2) {
    context.lineTo(points[1].x, points[1].y)
  } else {
    // Draw smooth curve through midpoints between consecutive points
    let mx = (points[0].x + points[1].x) / 2
    let my = (points[0].y + points[1].y) / 2
    context.lineTo(mx, my)
    for (let i = 1; i < points.length - 1; i++) {
      const nmx = (points[i].x + points[i + 1].x) / 2
      const nmy = (points[i].y + points[i + 1].y) / 2
      context.quadraticCurveTo(points[i].x, points[i].y, nmx, nmy)
    }
    context.lineTo(points[points.length - 1].x, points[points.length - 1].y)
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
      alpha: 0.5,
      dashPattern: [7, 6],
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
