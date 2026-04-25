import { useDrawingCanvas } from '../hooks/useDrawingCanvas'
import type { GuideType, Stroke } from '../types/drawing'
import { GuideOverlay } from './GuideOverlay'

type DrawingCanvasProps = {
  strokes: Stroke[]
  brushSize: number
  onStrokeComplete: (stroke: Stroke) => void
  guide?: GuideType | null
}

export function DrawingCanvas({
  strokes,
  brushSize,
  onStrokeComplete,
  guide = null,
}: DrawingCanvasProps) {
  const {
    canvasRef,
    containerRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  } = useDrawingCanvas({
    strokes,
    brushSize,
    onStrokeComplete,
  })

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900"
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