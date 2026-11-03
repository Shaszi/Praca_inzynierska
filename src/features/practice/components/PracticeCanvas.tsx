import { useState } from 'react'
import type { Point, SmoothingSettings, Stroke, Tool } from '../../../types/drawing'
import { DrawingCanvas } from '../../canvas/components/DrawingCanvas'
import { IDENTITY_VIEW, type CanvasView } from '../../canvas/utils/canvasPoint'
import { useCanvasColors } from '../../canvas/utils/themeColors'

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
  const [view, setView] = useState<CanvasView>(IDENTITY_VIEW)
  const colors = useCanvasColors()

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
        // Akcent, nie bladofiolet: to kreska, którą użytkownik ma narysować TERAZ.
        referenceStrokeColor={colors.accent}
        onViewChange={setView}
      />
      {errorMarker && (
        <span
          className="pointer-events-none absolute h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-danger bg-danger/10"
          style={{
            // Marker żyje w DOM, więc trzeba go przeliczyć z układu rysunku na ekran.
            // +1 px: ramka kontenera płótna.
            left: errorMarker.x * view.scale + view.offsetX + 1,
            top: errorMarker.y * view.scale + view.offsetY + 1,
          }}
          aria-hidden
        />
      )}
    </div>
  )
}
