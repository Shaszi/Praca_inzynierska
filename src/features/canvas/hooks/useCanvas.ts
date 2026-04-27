import { useCallback, useEffect, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { Point, Stroke, Tool } from '../../../types/drawing'
import { renderCanvasScene } from '../utils/canvasDrawing'
import { createPointFromPointerEvent } from '../utils/canvasPoint'

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
  onPointerDown: (event: ReactPointerEvent<HTMLCanvasElement>) => void
  onPointerMove: (event: ReactPointerEvent<HTMLCanvasElement>) => void
  onPointerUp: (event: ReactPointerEvent<HTMLCanvasElement>) => void
}

type CanvasMetrics = { width: number; height: number; dpr: number }

export function useCanvas({
  userStrokes,
  referenceStrokes = [],
  brushSize,
  tool = 'brush',
  userStrokeColor = '#1f2937',
  referenceStrokeColor = '#cbd5e1',
  onStrokeComplete,
  onEraseAtPoint,
  onCurrentStrokePointCountChange,
}: UseCanvasOptions): UseCanvasResult {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const metricsRef = useRef<CanvasMetrics>({ width: 0, height: 0, dpr: 1 })
  const activePointsRef = useRef<Point[]>([])
  const activeBrushSizeRef = useRef(brushSize)
  const isPointerActiveRef = useRef(false)

  const redrawScene = useCallback(() => {
    const canvas = canvasRef.current
    const metrics = metricsRef.current
    if (!canvas) return

    const context = canvas.getContext('2d')
    if (!context) return

    const activeStroke =
      tool === 'brush' && activePointsRef.current.length > 0
        ? { points: activePointsRef.current, brushSize: activeBrushSizeRef.current }
        : null

    renderCanvasScene({
      context,
      width: metrics.width,
      height: metrics.height,
      dpr: metrics.dpr,
      referenceStrokes,
      userStrokes,
      activeStroke,
      referenceStrokeColor,
      userStrokeColor,
    })
  }, [referenceStrokeColor, referenceStrokes, tool, userStrokeColor, userStrokes])

  const resizeCanvas = useCallback(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

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

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return

      event.preventDefault()
      canvas.setPointerCapture(event.pointerId)
      isPointerActiveRef.current = true

      const point = createPointFromPointerEvent(event, canvas)
      if (tool === 'eraser') {
        onEraseAtPoint?.(point)
        return
      }

      activeBrushSizeRef.current = brushSize
      activePointsRef.current = [point]
      onCurrentStrokePointCountChange?.(1)
      redrawScene()
    },
    [brushSize, onCurrentStrokePointCountChange, onEraseAtPoint, redrawScene, tool],
  )

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!isPointerActiveRef.current || !canvasRef.current) return

      const point = createPointFromPointerEvent(event, canvasRef.current)
      if (tool === 'eraser') {
        onEraseAtPoint?.(point)
        return
      }

      const points = activePointsRef.current
      const previousPoint = points[points.length - 1]
      if (previousPoint?.x === point.x && previousPoint.y === point.y) return

      points.push(point)
      onCurrentStrokePointCountChange?.(points.length)
      redrawScene()
    },
    [onCurrentStrokePointCountChange, onEraseAtPoint, redrawScene, tool],
  )

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!isPointerActiveRef.current) return

      const canvas = canvasRef.current
      if (canvas?.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
      isPointerActiveRef.current = false

      if (tool === 'brush' && activePointsRef.current.length > 0) {
        onStrokeComplete({ points: activePointsRef.current.map((point) => ({ ...point })), brushSize: activeBrushSizeRef.current })
      }

      activePointsRef.current = []
      onCurrentStrokePointCountChange?.(0)
      redrawScene()
    },
    [onCurrentStrokePointCountChange, onStrokeComplete, redrawScene, tool],
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver(resizeCanvas)
    observer.observe(container)
    resizeCanvas()
    return () => observer.disconnect()
  }, [resizeCanvas])

  useEffect(() => redrawScene(), [redrawScene])

  return { canvasRef, containerRef, onPointerDown, onPointerMove, onPointerUp }
}