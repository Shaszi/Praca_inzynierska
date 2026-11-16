import type { ReferenceDrawing, Stroke } from '../../types/drawing'

const BRUSH_SIZE = 6

const toStroke = (points: [number, number][]): Stroke => ({
  brushSize: BRUSH_SIZE,
  points: points.map(([x, y]) => ({ x, y, timestamp: 0 })),
})

const line = (x1: number, y1: number, x2: number, y2: number): Stroke =>
  toStroke([
    [x1, y1],
    [x2, y2],
  ])

const ELLIPSE_SAMPLES = 64

function ellipse(cx: number, cy: number, rx: number, ry: number, tiltDeg = 0): Stroke {
  const tilt = (tiltDeg * Math.PI) / 180
  const cos = Math.cos(tilt)
  const sin = Math.sin(tilt)
  const points: [number, number][] = []
  for (let i = 0; i <= ELLIPSE_SAMPLES; i++) {
    const angle = (i / ELLIPSE_SAMPLES) * Math.PI * 2
    const ex = Math.cos(angle) * rx
    const ey = Math.sin(angle) * ry
    points.push([cx + ex * cos - ey * sin, cy + ex * sin + ey * cos])
  }
  return toStroke(points)
}

export type Warmup = ReferenceDrawing & {
  minutes: number
}

export const WARMUPS: Warmup[] = [
  {
    id: 'warmup-lines',
    name: 'Proste linie',
    minutes: 2,
    createdAt: 0,
    strokes: [
      line(70, 70, 550, 70),
      line(70, 120, 550, 120),
      line(140, 170, 140, 340),
      line(480, 170, 480, 340),
      line(190, 340, 430, 170),
      line(190, 170, 430, 340),
    ],
  },
  {
    id: 'warmup-ellipses',
    name: 'Elipsy',
    minutes: 3,
    createdAt: 0,
    strokes: [
      ellipse(150, 120, 80, 50),
      ellipse(320, 120, 80, 35),
      ellipse(490, 120, 80, 22),
      ellipse(230, 280, 80, 40, -30),
      ellipse(410, 280, 80, 40, 30),
    ],
  },
]

export const isWarmupId = (id: string): boolean => WARMUPS.some((warmup) => warmup.id === id)
