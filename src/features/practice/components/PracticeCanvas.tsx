import type { Stroke } from '../../../types/drawing'
import { DrawingCanvas } from '../../canvas/components/DrawingCanvas'
import { ReferenceOverlay } from './ReferenceOverlay'

type PracticeCanvasProps = {
  userStrokes: Stroke[]
  referenceStrokes: Stroke[]
  brushSize: number
  userStrokeColor: string
  onStrokeComplete: (stroke: Stroke) => void
  onCurrentStrokePointCountChange: (count: number) => void
  onActiveStrokeChange: (stroke: Stroke | null) => void
}

export function PracticeCanvas({
  userStrokes,
  referenceStrokes,
  brushSize,
  userStrokeColor,
  onStrokeComplete,
  onCurrentStrokePointCountChange,
  onActiveStrokeChange,
}: PracticeCanvasProps) {
  return (
    <div className="relative h-full w-full">
      <ReferenceOverlay hasReference={referenceStrokes.length > 0} />
      <DrawingCanvas
        userStrokes={userStrokes}
        referenceStrokes={referenceStrokes}
        brushSize={brushSize}
        onStrokeComplete={onStrokeComplete}
        onCurrentStrokePointCountChange={onCurrentStrokePointCountChange}
        onActiveStrokeChange={onActiveStrokeChange}
        guide={null}
        userStrokeColor={userStrokeColor}
        referenceStrokeColor="#7dd3fc"
      />
    </div>
  )
}
