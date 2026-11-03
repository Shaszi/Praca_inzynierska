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

/** Wymazanie jako stempel, nie jako cięcie wektora. `afterStroke` to `strokes.length`
 *  w chwili postawienia stempla — dzięki temu replay wplata go w to samo miejsce
 *  kolejności, w którym powstał, i nowa kreska poprowadzona przez starą dziurę przeżyje. */
export type EraseStamp = {
  x: number
  y: number
  r: number
  afterStroke: number
}

export type Layer = {
  id: string
  name: string
  visible: boolean
  /** 0–1 */
  opacity: number
  strokes: Stroke[]
  erases: EraseStamp[]
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
