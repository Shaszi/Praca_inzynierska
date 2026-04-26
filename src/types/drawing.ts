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

export type GuideType = 'line' | 'circle'

export type ReferenceDrawing = {
  id: string
  name: string
  strokes: Stroke[]
  createdAt: number
}