import { useCallback, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useCanvas } from '../hooks/useCanvas'
import type { GuideType, Point, Stroke, Tool } from '../../../types/drawing'
import { CanvasOverlay } from './CanvasOverlay'
import { CanvasRenderer } from './CanvasRenderer'

type DrawingCanvasProps = {
  userStrokes: Stroke[]
  referenceStrokes?: Stroke[]
  brushSize: number
  tool?: Tool
  onStrokeComplete: (stroke: Stroke) => void
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
}

export function DrawingCanvas({
  userStrokes,
  referenceStrokes = [],
  brushSize,
  tool = 'brush',
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
}: DrawingCanvasProps) {
  // Imperative cursor ref — no React state, zero re-renders on pointermove
  const cursorRef = useRef<HTMLDivElement>(null)

  const { canvasRef, containerRef, onPointerDown, onPointerMove, onPointerUp } = useCanvas({
    userStrokes,
    referenceStrokes,
    brushSize,
    tool,
    onStrokeComplete,
    onEraseAtPoint,
    onEraseStart,
    onEraseEnd,
    onCurrentStrokePointCountChange,
    onActiveStrokeChange,
    userStrokeColor,
    referenceStrokeColor,
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

  // Cursor size derived from brushSize + tool — only recomputed when those change
  const cursorRadius = tool === 'eraser' ? brushSize * 1.25 : brushSize
  const cursorDiameter = cursorRadius * 2

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-inner"
    >
      {/* Background image — lowest layer */}
      {backgroundImageUrl && (
        <img
          src={backgroundImageUrl}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain opacity-20"
          draggable={false}
        />
      )}

      {/* Canvas — drawing surface */}
      <CanvasRenderer
        canvasRef={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={onPointerUp}
        onPointerEnter={updateCursorPreview}
        onPointerOut={hideCursorPreview}
        hideCursor={showCursorPreview}
      />

      {/* Guide overlay — on top of canvas so it's always visible */}
      <CanvasOverlay guide={guide} />

      {/* Cursor circle — topmost layer, always above strokes */}
      {showCursorPreview && (
        <div
          ref={cursorRef}
          className={`pointer-events-none absolute rounded-full border-2 ${
            tool === 'eraser' ? 'border-rose-400 bg-rose-100/30' : 'border-sky-400/70'
          }`}
          style={{
            opacity: 0,
            width: cursorDiameter,
            height: cursorDiameter,
            transform: 'translate(-50%, -50%)',
            // Transition only for size changes (brush slider), never for position
            transition: 'width 80ms, height 80ms',
          }}
        />
      )}
    </div>
  )
}
