import type { Point, Stroke, Tool } from '../../../types/drawing'
import { DrawingCanvas } from '../../canvas/components/DrawingCanvas'
import { ReferenceOverlay } from './ReferenceOverlay'

type PracticeCanvasProps = {
  userStrokes: Stroke[]
  referenceStrokes: Stroke[]
  brushSize: number
  tool?: Tool
  userStrokeColor: string
  onStrokeComplete: (stroke: Stroke) => void
  onCurrentStrokePointCountChange: (count: number) => void
  onActiveStrokeChange: (stroke: Stroke | null) => void
  onEraseStart?: () => void
  onEraseAtPoint?: (point: Point) => void
  onEraseEnd?: () => void
}

export function PracticeCanvas({
  userStrokes,
  referenceStrokes,
  brushSize,
  tool = 'brush',
  userStrokeColor,
  onStrokeComplete,
  onCurrentStrokePointCountChange,
  onActiveStrokeChange,
  onEraseStart,
  onEraseAtPoint,
  onEraseEnd,
}: PracticeCanvasProps) {
  return (
    <div className="relative h-full w-full">
      <ReferenceOverlay hasReference={referenceStrokes.length > 0} />
      <DrawingCanvas
        userStrokes={userStrokes}
        referenceStrokes={referenceStrokes}
        brushSize={brushSize}
        tool={tool}
        onStrokeComplete={onStrokeComplete}
        onEraseStart={onEraseStart}
        onEraseAtPoint={onEraseAtPoint}
        onEraseEnd={onEraseEnd}
        onCurrentStrokePointCountChange={onCurrentStrokePointCountChange}
        onActiveStrokeChange={onActiveStrokeChange}
        showCursorPreview
        guide={null}
        userStrokeColor={userStrokeColor}
        referenceStrokeColor="#7dd3fc"
      />
    </div>
  )
}
