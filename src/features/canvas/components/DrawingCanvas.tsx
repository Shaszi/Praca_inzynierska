import { useCallback, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useCanvas } from '../hooks/useCanvas'
import type { GuideType, Layer, Point, SmoothingSettings, Stroke, Tool } from '../../../types/drawing'
import { IDENTITY_VIEW, type Bounds, type CanvasView } from '../utils/canvasPoint'
import { useCanvasColors } from '../utils/themeColors'
import { CanvasOverlay } from './CanvasOverlay'
import { CanvasRenderer } from './CanvasRenderer'

type DrawingCanvasProps = {
  layers: Layer[]
  activeLayerId?: string
  referenceStrokes?: Stroke[]
  brushSize: number
  brushOpacity?: number
  tool?: Tool
  smoothing?: SmoothingSettings
  onStrokeComplete: (stroke: Stroke, rawPoints: Point[]) => void
  onEraseAtPoint?: (point: Point) => void
  onEraseStart?: () => void
  onEraseEnd?: () => void
  onCurrentStrokePointCountChange?: (count: number) => void
  onActiveStrokeChange?: (stroke: Stroke | null) => void
  showCursorPreview?: boolean
  guide?: GuideType | null
  userStrokeColor?: string
  referenceStrokeColor?: string
  backgroundImageUrl?: string
  onViewChange?: (view: CanvasView) => void
  fitBounds?: Bounds | null
  backgroundImageSize?: { width: number; height: number } | null
}

export function DrawingCanvas({
  layers,
  referenceStrokes = [],
  brushSize,
  brushOpacity,
  tool = 'brush',
  smoothing,
  onStrokeComplete,
  onEraseAtPoint,
  onEraseStart,
  onEraseEnd,
  onCurrentStrokePointCountChange,
  onActiveStrokeChange,
  showCursorPreview = false,
  guide = null,
  userStrokeColor,
  referenceStrokeColor,
  backgroundImageUrl,
  onViewChange,
  fitBounds = null,
  backgroundImageSize = null,
}: DrawingCanvasProps) {
  const cursorRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<CanvasView>(IDENTITY_VIEW)
  const colors = useCanvasColors()

  const handleViewChange = useCallback(
    (next: CanvasView) => {
      setView(next)
      onViewChange?.(next)
    },
    [onViewChange],
  )

  const { canvasRef, containerRef, onPointerDown, onPointerMove, onPointerUp } = useCanvas({
    layers,
    referenceStrokes,
    brushSize,
    brushOpacity,
    tool,
    smoothing,
    onStrokeComplete,
    onEraseAtPoint,
    onEraseStart,
    onEraseEnd,
    onCurrentStrokePointCountChange,
    onActiveStrokeChange,
    userStrokeColor: userStrokeColor ?? colors.ink,
    referenceStrokeColor: referenceStrokeColor ?? colors.lineStrong,
    onViewChange: handleViewChange,
    fitBounds,
  })

  const updateCursorPreview = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!showCursorPreview || !canvasRef.current || !cursorRef.current) return
      const bounds = canvasRef.current.getBoundingClientRect()
      const el = cursorRef.current
      el.style.opacity = '1'
      el.style.left = `${event.clientX - bounds.left}px`
      el.style.top = `${event.clientY - bounds.top}px`
    },
    [canvasRef, showCursorPreview],
  )

  const hideCursorPreview = useCallback(() => {
    if (cursorRef.current) cursorRef.current.style.opacity = '0'
  }, [])

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      updateCursorPreview(event)
      onPointerDown(event)
    },
    [onPointerDown, updateCursorPreview],
  )

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      updateCursorPreview(event)
      onPointerMove(event)
    },
    [onPointerMove, updateCursorPreview],
  )

  const cursorRadius = (tool === 'eraser' ? brushSize * 1.25 : brushSize) * view.scale
  const cursorDiameter = cursorRadius * 2

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden rounded-[22px] border border-line bg-paper-dim"
      style={{ backgroundImage: 'var(--canvas-dots)', backgroundSize: '22px 22px' }}
    >
      {backgroundImageUrl && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            transform: `translate(${view.offsetX}px, ${view.offsetY}px) scale(${view.scale})`,
            transformOrigin: '0 0',
          }}
        >
          <img
            src={backgroundImageUrl}
            alt=""
            // max-w-none: preflight daje obrazkom max-width:100%, a zdjęcie szersze niż kanwa
            // kurczyło się wtedy względem linii pomocniczych (np. po przypięciu menu).
            className={`select-none opacity-20 ${backgroundImageSize ? 'max-w-none' : 'h-full w-full object-contain'}`}
            style={backgroundImageSize ?? undefined}
            draggable={false}
          />
        </div>
      )}

      <CanvasRenderer
        canvasRef={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={onPointerUp}
        onPointerEnter={updateCursorPreview}
        onPointerOut={hideCursorPreview}
        hideCursor={showCursorPreview}
      />

      <CanvasOverlay guide={guide} />

      {showCursorPreview && (
        <div
          ref={cursorRef}
          className={`pointer-events-none absolute rounded-full border-[1.5px] ${
            tool === 'eraser' ? 'border-danger bg-danger-soft/40' : 'border-ink/40'
          }`}
          style={{
            opacity: 0,
            width: cursorDiameter,
            height: cursorDiameter,
            transform: 'translate(-50%, -50%)',
            transition: 'width 80ms, height 80ms',
          }}
        />
      )}
    </div>
  )
}
