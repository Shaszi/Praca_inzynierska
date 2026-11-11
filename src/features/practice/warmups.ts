import type { ReferenceDrawing, Stroke } from '../../types/drawing'

/**
 * Wbudowane rozgrzewki: te same `ReferenceDrawing` co wzorce z bazy, tylko policzone
 * tutaj, więc nowe konto ma od czego zacząć bez zapisanego wzorca. Idą zwykłą ścieżką
 * ćwiczenia — ocena, komentarz AI i sesja nie wiedzą, że wzorzec nie jest z bazy.
 *
 * Współrzędne są w pikselach płótna (tak samo jak wzorce rysowane w edytorze) i trzymają
 * się ramki 570×350, żeby zmieściły się na płótnie ćwiczenia bez przewijania.
 */

/** Grubość wzoru wchodzi w tolerancję odchylenia (`offsetTolerance`) — to domyślny pędzel. */
const BRUSH_SIZE = 6

// Punkty wzorca nie mają czasu: ocena bierze z nich tylko kształt, a tempo liczy z kreski
// użytkownika. Zero zamiast daty trzyma wzorce deterministyczne.
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

/** Elipsa jako domknięta polilinia; `tiltDeg` obraca ją wokół środka. */
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
  /** Orientacyjny czas ćwiczenia, pokazywany na kafelku na pulpicie. */
  minutes: number
}

export const WARMUPS: Warmup[] = [
  {
    id: 'warmup-lines',
    name: 'Proste linie',
    minutes: 2,
    createdAt: 0,
    // Od najłatwiejszego ruchu do najtrudniejszego: poziome, pionowe, na skos.
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
    // Coraz bardziej spłaszczone, na końcu przechylone — tak jak elipsy w perspektywie.
    strokes: [
      ellipse(150, 120, 80, 50),
      ellipse(320, 120, 80, 35),
      ellipse(490, 120, 80, 22),
      ellipse(230, 280, 80, 40, -30),
      ellipse(410, 280, 80, 40, 30),
    ],
  },
]

/**
 * Rozgrzewka nie ma wiersza w `drawing_references`, więc jej id nie może trafić do
 * `practice_sessions.reference_id` (klucz obcy) — sesja zapisuje się wtedy bez wzorca.
 */
export const isWarmupId = (id: string): boolean => WARMUPS.some((warmup) => warmup.id === id)
