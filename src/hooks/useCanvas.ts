import { useCallback, useEffect, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { Point, Stroke, Tool } from '../types/drawing'

type UseCanvasOptions = {
  userStrokes: Stroke[]
  referenceStrokes?: Stroke[]
  brushSize: number
  tool?: Tool
  userStrokeColor?: string
  referenceStrokeColor?: string
  onStrokeComplete: (stroke: Stroke) => void
  onEraseAtPoint?: (point: Point) => void
  onCurrentStrokePointCountChange?: (count: number) => void
}

type UseCanvasResult = {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  containerRef: React.RefObject<HTMLDivElement | null>
  handlePointerDown: (event: ReactPointerEvent<HTMLCanvasElement>) => void
  handlePointerMove: (event: ReactPointerEvent<HTMLCanvasElement>) => void
  handlePointerUp: (event: ReactPointerEvent<HTMLCanvasElement>) => void
}

type CanvasMetrics = {
  width: number
  height: number
  dpr: number
}

const DEFAULT_USER_STROKE_COLOR = '#1f2937'
const DEFAULT_REFERENCE_STROKE_COLOR = '#cbd5e1'

export function useCanvas({
  userStrokes,
  referenceStrokes = [],
  brushSize,
  tool = 'brush',
  userStrokeColor = DEFAULT_USER_STROKE_COLOR,
  referenceStrokeColor = DEFAULT_REFERENCE_STROKE_COLOR,
  onStrokeComplete,
  onEraseAtPoint,
  onCurrentStrokePointCountChange,
}: UseCanvasOptions): UseCanvasResult {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const isPointerActiveRef = useRef(false)
  const currentStrokePointsRef = useRef<Point[]>([])
  const currentStrokeBrushSizeRef = useRef(brushSize)
  const drawQueueRef = useRef<Point[]>([])
  const lastDrawnPointRef = useRef<Point | null>(null)
  const frameIdRef = useRef<number | null>(null)
  const metricsRef = useRef<CanvasMetrics>({
    width: 0,
    height: 0,
    dpr: 1,
  })

  const configureContext = useCallback(
    (
      context: CanvasRenderingContext2D,
      color: string,
      lineWidth: number,
      alpha = 1,
    ) => {
      const { dpr } = metricsRef.current
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      context.lineCap = 'round'
      context.lineJoin = 'round'
      context.strokeStyle = color
      context.fillStyle = color
      context.lineWidth = lineWidth
      context.globalAlpha = alpha
    },
    [],
  )

  const drawStroke = useCallback(
    (
      context: CanvasRenderingContext2D,
      stroke: Stroke,
      color: string,
      lineWidthOverride?: number,
      alpha = 1,
    ) => {
      if (stroke.points.length === 0) {
        return
      }

      const lineWidth = lineWidthOverride ?? stroke.brushSize
      configureContext(context, color, lineWidth, alpha)

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
    },
    [configureContext],
  )

  const redrawScene = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const context = canvas.getContext('2d')
    if (!context) {
      return
    }

    const { width, height } = metricsRef.current
    context.clearRect(0, 0, width, height)

    for (const stroke of referenceStrokes) {
      drawStroke(context, stroke, referenceStrokeColor, undefined, 0.9)
    }

    for (const stroke of userStrokes) {
      drawStroke(context, stroke, userStrokeColor)
    }

    if (currentStrokePointsRef.current.length > 0 && tool === 'brush') {
      drawStroke(
        context,
        {
          points: currentStrokePointsRef.current,
          brushSize: currentStrokeBrushSizeRef.current,
        },
        userStrokeColor,
      )
    }

    context.globalAlpha = 1
  }, [drawStroke, referenceStrokeColor, referenceStrokes, tool, userStrokeColor, userStrokes])

  const drawQueuedPoints = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const context = canvas.getContext('2d')
    if (!context) {
      return
    }

    const queue = drawQueueRef.current
    if (queue.length === 0) {
      return
    }

    configureContext(context, userStrokeColor, currentStrokeBrushSizeRef.current)

    const startPoint = lastDrawnPointRef.current ?? queue[0]
    context.beginPath()
    context.moveTo(startPoint.x, startPoint.y)

    for (const point of queue) {
      context.lineTo(point.x, point.y)
      lastDrawnPointRef.current = point
    }

    context.stroke()
    queue.length = 0
  }, [configureContext, userStrokeColor])

  const scheduleFrame = useCallback(() => {
    if (frameIdRef.current !== null) {
      return
    }

    frameIdRef.current = window.requestAnimationFrame(() => {
      frameIdRef.current = null
      drawQueuedPoints()
    })
  }, [drawQueuedPoints])

  const resizeCanvas = useCallback(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) {
      return
    }

    const width = Math.max(container.clientWidth, 1)
    const height = Math.max(container.clientHeight, 1)
    const dpr = window.devicePixelRatio || 1

    canvas.width = Math.floor(width * dpr)
    canvas.height = Math.floor(height * dpr)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    metricsRef.current = { width, height, dpr }

    redrawScene()
  }, [redrawScene])

  const buildPointFromEvent = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>): Point | null => {
      const canvas = canvasRef.current
      if (!canvas) {
        return null
      }

      const bounds = canvas.getBoundingClientRect()
      return {
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
        timestamp: Date.now(),
      }
    },
    [],
  )

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      const point = buildPointFromEvent(event)
      if (!canvas || !point) {
        return
      }

      event.preventDefault()
      canvas.setPointerCapture(event.pointerId)

      isPointerActiveRef.current = true

      if (tool === 'eraser') {
        onEraseAtPoint?.(point)
        return
      }

      currentStrokeBrushSizeRef.current = brushSize
      currentStrokePointsRef.current = [point]
      drawQueueRef.current = [point]
      lastDrawnPointRef.current = point
      onCurrentStrokePointCountChange?.(1)

      const context = canvas.getContext('2d')
      if (context) {
        configureContext(context, userStrokeColor, currentStrokeBrushSizeRef.current)
        context.beginPath()
        context.arc(
          point.x,
          point.y,
          currentStrokeBrushSizeRef.current / 2,
          0,
          Math.PI * 2,
        )
        context.fill()
      }

      scheduleFrame()
    },
    [
      brushSize,
      buildPointFromEvent,
      configureContext,
      onCurrentStrokePointCountChange,
      onEraseAtPoint,
      scheduleFrame,
      tool,
      userStrokeColor,
    ],
  )

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!isPointerActiveRef.current) {
        return
      }

      const point = buildPointFromEvent(event)
      if (!point) {
        return
      }

      if (tool === 'eraser') {
        onEraseAtPoint?.(point)
        return
      }

      const activePoints = currentStrokePointsRef.current
      const previousPoint = activePoints[activePoints.length - 1]

      if (previousPoint && previousPoint.x === point.x && previousPoint.y === point.y) {
        return
      }

      activePoints.push(point)
      onCurrentStrokePointCountChange?.(activePoints.length)
      drawQueueRef.current.push(point)
      scheduleFrame()
    },
    [buildPointFromEvent, onCurrentStrokePointCountChange, onEraseAtPoint, scheduleFrame, tool],
  )

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!isPointerActiveRef.current) {
        return
      }

      const canvas = canvasRef.current
      if (canvas?.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId)
      }

      isPointerActiveRef.current = false

      if (tool === 'eraser') {
        currentStrokePointsRef.current = []
        drawQueueRef.current = []
        lastDrawnPointRef.current = null
        onCurrentStrokePointCountChange?.(0)
        redrawScene()
        return
      }

      if (frameIdRef.current !== null) {
        window.cancelAnimationFrame(frameIdRef.current)
        frameIdRef.current = null
      }

      drawQueuedPoints()

      const completedPoints = currentStrokePointsRef.current.map((point) => ({ ...point }))
      if (completedPoints.length > 0) {
        onStrokeComplete({
          points: completedPoints,
          brushSize: currentStrokeBrushSizeRef.current,
        })
      }

      currentStrokePointsRef.current = []
      drawQueueRef.current = []
      lastDrawnPointRef.current = null
      onCurrentStrokePointCountChange?.(0)
      redrawScene()
    },
    [drawQueuedPoints, onCurrentStrokePointCountChange, onStrokeComplete, redrawScene, tool],
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const observer = new ResizeObserver(() => {
      resizeCanvas()
    })

    observer.observe(container)
    resizeCanvas()

    return () => {
      observer.disconnect()
    }
  }, [resizeCanvas])

  useEffect(() => {
    redrawScene()
  }, [redrawScene])

  useEffect(() => {
    return () => {
      if (frameIdRef.current !== null) {
        window.cancelAnimationFrame(frameIdRef.current)
      }

      onCurrentStrokePointCountChange?.(0)
    }
  }, [onCurrentStrokePointCountChange])

  return {
    canvasRef,
    containerRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  }
}