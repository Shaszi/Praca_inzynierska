export type Point = {
  x: number
  y: number
  timestamp: number
}

export type Stroke = {
  points: Point[]
  brushSize: number
}

export type Tool = 'brush' | 'eraser'

export type SmoothingMode = 'off' | 'adaptive' | 'rope'

export type SmoothingSettings = {
  mode: SmoothingMode
  // 0–100, interpreted per mode (filter cutoff / rope length / simplification tolerance)
  strength: number
}

export type GuideType = 'line' | 'circle'

export type Guide = {
  id: string
  strokes: Stroke[]
}

export type ReferenceDrawing = {
  id: string
  name: string
  strokes: Stroke[]
  createdAt: number
}
