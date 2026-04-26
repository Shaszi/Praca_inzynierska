import { useCanvas } from '../hooks/useCanvas'
import type { GuideType, Stroke } from '../types/drawing'
import { GuideOverlay } from './GuideOverlay'

type DrawingCanvasProps = {
  userStrokes: Stroke[]
  referenceStrokes?: Stroke[]
  brushSize: number
  onStrokeComplete: (stroke: Stroke) => void
  onCurrentStrokePointCountChange?: (count: number) => void
  guide?: GuideType | null
}

export function DrawingCanvas({
  userStrokes,
  referenceStrokes = [],
  brushSize,
  onStrokeComplete,
  onCurrentStrokePointCountChange,
  guide = null,
}: DrawingCanvasProps) {
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
    onStrokeComplete,
    onCurrentStrokePointCountChange,
  })

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden rounded-2xl border border-slate-300 bg-slate-100 shadow-inner"
    >
      {guide ? <GuideOverlay guide={guide} /> : null}
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onContextMenu={(event) => event.preventDefault()}
        className="absolute inset-0 h-full w-full touch-none cursor-crosshair"
      />
    </div>
  )
}