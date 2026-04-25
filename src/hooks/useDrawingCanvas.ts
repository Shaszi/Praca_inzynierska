import { useCallback, useEffect, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { Point, Stroke } from '../types/drawing'

type UseDrawingCanvasOptions = {
  strokes: Stroke[]
  brushSize: number
  strokeColor?: string
  onStrokeComplete: (stroke: Stroke) => void
}

type UseDrawingCanvasResult = {
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

const DEFAULT_STROKE_COLOR = '#e2e8f0'

export function useDrawingCanvas({
  strokes,
  brushSize,
  strokeColor = DEFAULT_STROKE_COLOR,
  onStrokeComplete,
}: UseDrawingCanvasOptions): UseDrawingCanvasResult {
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
    (context: CanvasRenderingContext2D) => {
      const { dpr } = metricsRef.current
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      context.lineCap = 'round'
      context.lineJoin = 'round'
      context.strokeStyle = strokeColor
      context.fillStyle = strokeColor
      context.lineWidth = brushSize
    },
    [brushSize, strokeColor],
  )

  const drawStroke = useCallback(
    (context: CanvasRenderingContext2D, stroke: Stroke) => {
      if (stroke.length === 0) {
        return
      }

      configureContext(context)

      if (stroke.length === 1) {
        context.beginPath()
        context.arc(stroke[0].x, stroke[0].y, brushSize / 2, 0, Math.PI * 2)
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
    [brushSize, configureContext],
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

    for (const stroke of strokes) {
      drawStroke(context, stroke)
    }

    if (currentStrokeRef.current.length > 0) {
      drawStroke(context, currentStrokeRef.current)
    }
  }, [drawStroke, strokes])

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

    configureContext(context)

    const startPoint = lastDrawnPointRef.current ?? queue[0]
    context.beginPath()
    context.moveTo(startPoint.x, startPoint.y)

    for (const point of queue) {
      context.lineTo(point.x, point.y)
      lastDrawnPointRef.current = point
    }

    context.stroke()
    queue.length = 0
  }, [configureContext])

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

    const context = canvas.getContext('2d')
    if (context) {
      configureContext(context)
    }

    redrawScene()
  }, [configureContext, redrawScene])

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

      const context = canvas.getContext('2d')
      if (context) {
        configureContext(context)
        context.beginPath()
        context.arc(point.x, point.y, brushSize / 2, 0, Math.PI * 2)
        context.fill()
      }

      scheduleFrame()
    },
    [brushSize, buildPointFromEvent, configureContext, scheduleFrame],
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
      drawQueueRef.current.push(point)
      scheduleFrame()
    },
    [buildPointFromEvent, scheduleFrame],
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
    },
    [drawQueuedPoints, onStrokeComplete],
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
    }
  }, [])

  return {
    canvasRef,
    containerRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  }
}
