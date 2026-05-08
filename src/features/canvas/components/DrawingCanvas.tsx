import { useCallback, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useCanvas } from '../hooks/useCanvas'
import type { GuideType, Point, Stroke, Tool } from '../../../types/drawing'
import { CanvasOverlay } from './CanvasOverlay'
import { CanvasRenderer } from './CanvasRenderer'

type CursorPreview = { x: number; y: number; visible: boolean }

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
  onEraseStart,
  onEraseEnd,
  onCurrentStrokePointCountChange,
  showCursorPreview = false,
  guide = null,
}: DrawingCanvasProps) {
  const [cursorPreview, setCursorPreview] = useState<CursorPreview>({
    x: 0,
    y: 0,
    visible: false,
  })

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
  })

  const updateCursorPreview = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!showCursorPreview || !canvasRef.current) return

      const bounds = canvasRef.current.getBoundingClientRect()
      setCursorPreview({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
        visible: true,
      })
    },
    [canvasRef, showCursorPreview],
  )

  const hideCursorPreview = useCallback(() => {
    if (!showCursorPreview) return
    setCursorPreview((previous) => ({ ...previous, visible: false }))
  }, [showCursorPreview])

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

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden rounded-2xl border border-slate-300 bg-slate-100 shadow-inner"
    >
      <CanvasOverlay
        guide={guide}
        showCursorPreview={showCursorPreview}
        cursorPreview={cursorPreview}
        brushSize={brushSize}
        tool={tool}
      />
      <CanvasRenderer
        canvasRef={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={onPointerUp}
        onPointerEnter={updateCursorPreview}
        onPointerOut={hideCursorPreview}
      />
    </div>
  )
}
