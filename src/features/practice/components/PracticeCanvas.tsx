import type { MutableRefObject } from 'react'
import type { CanvasControls } from '../../canvas/hooks/useCanvas'
import { useState } from 'react'
import type { Layer, Point, SmoothingSettings, Stroke, Tool } from '../../../types/drawing'
import { DrawingCanvas } from '../../canvas/components/DrawingCanvas'
import { IDENTITY_VIEW, type Bounds, type CanvasView, toScreen } from '../../canvas/utils/canvasPoint'
import { useCanvasColors } from '../../canvas/utils/themeColors'

type PracticeCanvasProps = {
  layers: Layer[]
  activeLayerId: string
  referenceStrokes: Stroke[]
  brushSize: number
  brushOpacity?: number
  tool?: Tool
  smoothing?: SmoothingSettings
  userStrokeColor: string
  onStrokeComplete: (stroke: Stroke, rawPoints: Point[]) => void
  onCurrentStrokePointCountChange: (count: number) => void
  onActiveStrokeChange: (stroke: Stroke | null) => void
  onEraseStart?: () => void
  onEraseAtPoint?: (point: Point) => void
  onEraseEnd?: () => void
  errorMarker?: { x: number; y: number } | null
  fitBounds?: Bounds | null
  followGuide?: boolean
  guideOpacity?: number
  penOnly?: boolean
  allowRotation?: boolean
  onUndoGesture?: () => void
  onRedoGesture?: () => void
  controlsRef?: MutableRefObject<CanvasControls | null>
}

export function PracticeCanvas({
  layers,
  activeLayerId,
  referenceStrokes,
  brushSize,
  brushOpacity,
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
  fitBounds = null,
  followGuide = true,
  guideOpacity = 1,
  penOnly = false,
  allowRotation = true,
  onUndoGesture,
  onRedoGesture,
  controlsRef,
}: PracticeCanvasProps) {
  const [view, setView] = useState<CanvasView>(IDENTITY_VIEW)
  const colors = useCanvasColors()

  return (
    <div className="relative h-full w-full">
      <DrawingCanvas
        layers={layers}
        activeLayerId={activeLayerId}
        referenceStrokes={referenceStrokes}
        brushSize={brushSize}
        brushOpacity={brushOpacity}
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
        referenceStrokeColor={colors.violet}
        onViewChange={setView}
        fitBounds={fitBounds}
        followGuide={followGuide}
        guideOpacity={guideOpacity}
        penOnly={penOnly}
        allowRotation={allowRotation}
        onUndoGesture={onUndoGesture}
        onRedoGesture={onRedoGesture}
        controlsRef={controlsRef}
      />
      {errorMarker && (
        <span
          className="pointer-events-none absolute h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-danger bg-danger/10"
          style={{
            // +1 px: ramka kontenera płótna.
            left: toScreen(errorMarker, view).x + 1,
            top: toScreen(errorMarker, view).y + 1,
          }}
          aria-hidden
        />
      )}
    </div>
  )
}
