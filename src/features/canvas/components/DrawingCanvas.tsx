import { useCallback, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useCanvas } from '../hooks/useCanvas'
import type { GuideType, Point, SmoothingSettings, Stroke, Tool } from '../../../types/drawing'
import { IDENTITY_VIEW, type CanvasView } from '../utils/canvasPoint'
import { CanvasOverlay } from './CanvasOverlay'
import { CanvasRenderer } from './CanvasRenderer'

type DrawingCanvasProps = {
  userStrokes: Stroke[]
  referenceStrokes?: Stroke[]
  brushSize: number
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
  /** Pozwala rodzicowi ustawić nakładki w układzie rysunku (np. marker błędu). */
  onViewChange?: (view: CanvasView) => void
}

export function DrawingCanvas({
  userStrokes,
  referenceStrokes = [],
  brushSize,
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
}: DrawingCanvasProps) {
  // Imperative cursor ref — no React state, zero re-renders on pointermove
  const cursorRef = useRef<HTMLDivElement>(null)
  // Widok w stanie Reacta: zmienia się przy tyknięciu kółka, nie co ruch wskaźnika.
  const [view, setView] = useState<CanvasView>(IDENTITY_VIEW)

  const handleViewChange = useCallback(
    (next: CanvasView) => {
      setView(next)
      onViewChange?.(next)
    },
    [onViewChange],
  )

  const { canvasRef, containerRef, onPointerDown, onPointerMove, onPointerUp } = useCanvas({
    userStrokes,
    referenceStrokes,
    brushSize,
    tool,
    smoothing,
    onStrokeComplete,
    onEraseAtPoint,
    onEraseStart,
    onEraseEnd,
    onCurrentStrokePointCountChange,
    onActiveStrokeChange,
    userStrokeColor,
    referenceStrokeColor,
    onViewChange: handleViewChange,
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

  // Cursor size derived from brushSize + tool — only recomputed when those change.
  // Mnożone przez skalę, bo pędzel ma na ekranie taką grubość, jaką naprawdę zostawi.
  const cursorRadius = (tool === 'eraser' ? brushSize * 1.25 : brushSize) * view.scale
  const cursorDiameter = cursorRadius * 2

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden rounded-xl border border-line bg-surface"
    >
      {/* Background image — lowest layer. Jedzie z widokiem, inaczej po przybliżeniu
          zdjęcie zostałoby na miejscu, a rysunek odjechał. */}
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
            className="h-full w-full select-none object-contain opacity-20"
            draggable={false}
          />
        </div>
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
          className={`pointer-events-none absolute rounded-full border-[1.5px] ${
            tool === 'eraser' ? 'border-danger bg-danger-soft/40' : 'border-ink/40'
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
