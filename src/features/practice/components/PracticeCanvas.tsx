import type { Point, SmoothingSettings, Stroke, Tool } from '../../../types/drawing'
import { DrawingCanvas } from '../../canvas/components/DrawingCanvas'

type PracticeCanvasProps = {
  userStrokes: Stroke[]
  referenceStrokes: Stroke[]
  brushSize: number
  tool?: Tool
  smoothing?: SmoothingSettings
  userStrokeColor: string
  onStrokeComplete: (stroke: Stroke, rawPoints: Point[]) => void
  onCurrentStrokePointCountChange: (count: number) => void
  onActiveStrokeChange: (stroke: Stroke | null) => void
  onEraseStart?: () => void
  onEraseAtPoint?: (point: Point) => void
  onEraseEnd?: () => void
  /** Miejsce największego błędu ostatniej kreski (współrzędne płótna). */
  errorMarker?: { x: number; y: number } | null
}

export function PracticeCanvas({
  userStrokes,
  referenceStrokes,
  brushSize,
  tool = 'brush',
  smoothing,
  userStrokeColor,
  onStrokeComplete,
  onCurrentStrokePointCountChange,
  onActiveStrokeChange,
  onEraseStart,
  onEraseAtPoint,
  onEraseEnd,
  errorMarker = null,
}: PracticeCanvasProps) {
  return (
    <div className="relative h-full w-full">
      <DrawingCanvas
        userStrokes={userStrokes}
        referenceStrokes={referenceStrokes}
        brushSize={brushSize}
        tool={tool}
        smoothing={smoothing}
        onStrokeComplete={onStrokeComplete}
        onEraseStart={onEraseStart}
        onEraseAtPoint={onEraseAtPoint}
        onEraseEnd={onEraseEnd}
        onCurrentStrokePointCountChange={onCurrentStrokePointCountChange}
        onActiveStrokeChange={onActiveStrokeChange}
        showCursorPreview
        guide={null}
        userStrokeColor={userStrokeColor}
        referenceStrokeColor="#9db2e8"
      />
      {errorMarker && (
        <span
          className="pointer-events-none absolute h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#c25a00] bg-[#c25a00]/10"
          // +1 px: ramka kontenera płótna
          style={{ left: errorMarker.x + 1, top: errorMarker.y + 1 }}
          aria-hidden
        />
      )}
    </div>
  )
}
