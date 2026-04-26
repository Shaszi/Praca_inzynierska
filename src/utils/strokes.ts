import type { Stroke } from '../types/drawing'

export function cloneStrokes(strokes: Stroke[]): Stroke[] {
  return strokes.map((stroke) => ({
    brushSize: stroke.brushSize,
    points: stroke.points.map((point) => ({
      x: point.x,
      y: point.y,
      timestamp: point.timestamp,
    })),
  }))
}