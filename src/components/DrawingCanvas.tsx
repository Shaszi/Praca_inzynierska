import { useCallback, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useCanvas } from '../hooks/useCanvas'
import type { GuideType, Point, Stroke, Tool } from '../types/drawing'
import { GuideOverlay } from './GuideOverlay'

type CursorPreview = {
  x: number
  y: number
  visible: boolean
}

type DrawingCanvasProps = {
  userStrokes: Stroke[]
  referenceStrokes?: Stroke[]
  brushSize: number
  tool?: Tool
  onStrokeComplete: (stroke: Stroke) => void
  onEraseAtPoint?: (point: Point) => void
  onCurrentStrokePointCountChange?: (count: number) => void
  showCursorPreview?: boolean
  guide?: GuideType | null
}

export function DrawingCanvas({
  userStrokes,
  referenceStrokes = [],
  brushSize,
  tool = 'brush',
  onStrokeComplete,
  onEraseAtPoint,
  onCurrentStrokePointCountChange,
  showCursorPreview = false,
  guide = null,
}: DrawingCanvasProps) {
  const [cursorPreview, setCursorPreview] = useState<CursorPreview>({
    x: 0,
    y: 0,
    visible: false,
  })

  const {
    canvasRef,
    containerRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  } = useCanvas({
    userStrokes,
    referenceStrokes,
    brushSize,
    tool,
    onStrokeComplete,
    onEraseAtPoint,
    onCurrentStrokePointCountChange,
  })

  const updateCursorPreview = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!showCursorPreview || !canvasRef.current) {
        return
      }

      const bounds = canvasRef.current.getBoundingClientRect()
      setCursorPreview({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
        visible: true,
      })
    },
    [canvasRef, showCursorPreview],
  )

  const handleCanvasPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      updateCursorPreview(event)
      handlePointerDown(event)
    },
    [handlePointerDown, updateCursorPreview],
  )

  const handleCanvasPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      updateCursorPreview(event)
      handlePointerMove(event)
    },
    [handlePointerMove, updateCursorPreview],
  )

  const handleCanvasPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      handlePointerUp(event)
    },
    [handlePointerUp],
  )

  const hideCursorPreview = useCallback(() => {
    if (!showCursorPreview) {
      return
    }

    setCursorPreview((previous) => ({ ...previous, visible: false }))
  }, [showCursorPreview])

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden rounded-2xl border border-slate-300 bg-slate-100 shadow-inner"
    >
      {guide ? <GuideOverlay guide={guide} /> : null}
      <canvas
        ref={canvasRef}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleCanvasPointerMove}
        onPointerUp={handleCanvasPointerUp}
        onPointerLeave={handleCanvasPointerUp}
        onPointerCancel={handleCanvasPointerUp}
        onPointerEnter={updateCursorPreview}
        onPointerOut={hideCursorPreview}
        onContextMenu={(event) => event.preventDefault()}
        className="absolute inset-0 h-full w-full touch-none cursor-crosshair"
      />

      {showCursorPreview && cursorPreview.visible ? (
        <div
          className={`pointer-events-none absolute rounded-full border ${
            tool === 'eraser' ? 'border-rose-400/80 bg-rose-100/20' : 'border-sky-400/70'
          }`}
          style={{
            width: `${brushSize * 2}px`,
            height: `${brushSize * 2}px`,
            left: `${cursorPreview.x - brushSize}px`,
            top: `${cursorPreview.y - brushSize}px`,
          }}
        />
      ) : null}
    </div>
  )
}