import { useCallback, useEffect, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { Point, Stroke } from '../types/drawing'

type UseCanvasOptions = {
  userStrokes: Stroke[]
  referenceStrokes?: Stroke[]
  brushSize: number
  userStrokeColor?: string
  referenceStrokeColor?: string
  onStrokeComplete: (stroke: Stroke) => void
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
  userStrokeColor = DEFAULT_USER_STROKE_COLOR,
  referenceStrokeColor = DEFAULT_REFERENCE_STROKE_COLOR,
  onStrokeComplete,
  onCurrentStrokePointCountChange,
}: UseCanvasOptions): UseCanvasResult {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const isDrawingRef = useRef(false)
  const currentStrokeRef = useRef<Stroke>([])
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
      lineWidth: number,
      alpha = 1,
    ) => {
      if (stroke.length === 0) {
        return
      }

      configureContext(context, color, lineWidth, alpha)

      if (stroke.length === 1) {
        context.beginPath()
        context.arc(stroke[0].x, stroke[0].y, lineWidth / 2, 0, Math.PI * 2)
        context.fill()
        return
      }

      context.beginPath()
      context.moveTo(stroke[0].x, stroke[0].y)
      for (let index = 1; index < stroke.length; index += 1) {
        context.lineTo(stroke[index].x, stroke[index].y)
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
      drawStroke(context, stroke, referenceStrokeColor, Math.max(brushSize - 1, 1), 0.9)
    }

    for (const stroke of userStrokes) {
      drawStroke(context, stroke, userStrokeColor, brushSize)
    }

    if (currentStrokeRef.current.length > 0) {
      drawStroke(context, currentStrokeRef.current, userStrokeColor, brushSize)
    }

    context.globalAlpha = 1
  }, [brushSize, drawStroke, referenceStrokeColor, referenceStrokes, userStrokeColor, userStrokes])

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

    configureContext(context, userStrokeColor, brushSize)

    const startPoint = lastDrawnPointRef.current ?? queue[0]
    context.beginPath()
    context.moveTo(startPoint.x, startPoint.y)

    for (const point of queue) {
      context.lineTo(point.x, point.y)
      lastDrawnPointRef.current = point
    }

    context.stroke()
    queue.length = 0
  }, [brushSize, configureContext, userStrokeColor])

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

      isDrawingRef.current = true
      currentStrokeRef.current = [point]
      drawQueueRef.current = [point]
      lastDrawnPointRef.current = point

      onCurrentStrokePointCountChange?.(1)

      const context = canvas.getContext('2d')
      if (context) {
        configureContext(context, userStrokeColor, brushSize)
        context.beginPath()
        context.arc(point.x, point.y, brushSize / 2, 0, Math.PI * 2)
        context.fill()
      }

      scheduleFrame()
    },
    [
      brushSize,
      buildPointFromEvent,
      configureContext,
      onCurrentStrokePointCountChange,
      scheduleFrame,
      userStrokeColor,
    ],
  )

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!isDrawingRef.current) {
        return
      }

      const point = buildPointFromEvent(event)
      if (!point) {
        return
      }

      const activeStroke = currentStrokeRef.current
      const previousPoint = activeStroke[activeStroke.length - 1]

      if (previousPoint && previousPoint.x === point.x && previousPoint.y === point.y) {
        return
      }

      activeStroke.push(point)
      onCurrentStrokePointCountChange?.(activeStroke.length)

      drawQueueRef.current.push(point)
      scheduleFrame()
    },
    [buildPointFromEvent, onCurrentStrokePointCountChange, scheduleFrame],
  )

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!isDrawingRef.current) {
        return
      }

      const canvas = canvasRef.current
      if (canvas?.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId)
      }

      if (frameIdRef.current !== null) {
        window.cancelAnimationFrame(frameIdRef.current)
        frameIdRef.current = null
      }

      drawQueuedPoints()

      const completedStroke = currentStrokeRef.current.map((point) => ({ ...point }))
      if (completedStroke.length > 0) {
        onStrokeComplete(completedStroke)
      }

      isDrawingRef.current = false
      currentStrokeRef.current = []
      drawQueueRef.current = []
      lastDrawnPointRef.current = null
      onCurrentStrokePointCountChange?.(0)
      redrawScene()
    },
    [drawQueuedPoints, onCurrentStrokePointCountChange, onStrokeComplete, redrawScene],
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