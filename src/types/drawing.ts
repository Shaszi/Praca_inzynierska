export type Point = {
  x: number
  y: number
  timestamp: number
}

export type Stroke = {
  points: Point[]
  brushSize: number
  /** Kolor nadany przy rysowaniu. Brak = kolor domyślny płótna (stare zapisy i wzorce). */
  color?: string
  /** 0–1. Brak = pełne krycie. */
  opacity?: number
  /** Krok wzorca, który ta kreska odrysowuje. Bez tego powiązanie kreski z krokiem
   *  byłoby tylko pozycyjne i rozjeżdżało się po rysowaniu na szkicu albo wymazaniu. */
  stepIndex?: number
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
  /** Zablokowana warstwa nie przyjmuje kresek ani gumki. */
  locked?: boolean
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

export type Publication = 'private' | 'pending' | 'public' | 'rejected'

export type ReferenceDrawing = {
  id: string
  name: string
  strokes: Stroke[]
  createdAt: number
  /** Stan publikacji. Brak = stary zapis albo plik z dysku, traktujemy jak prywatny. */
  publication?: Publication
  /** Czy wiersz należy do zalogowanego użytkownika. W bibliotece współdzielonej
   *  nie można tego założyć, a od tego zależą przyciski usuwania i publikacji. */
  isMine?: boolean
  authorName?: string
  moderationReason?: string | null
}
