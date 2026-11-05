import type { EraseStamp, Layer, Stroke } from '../../../types/drawing'
import { IDENTITY_VIEW, type CanvasView } from './canvasPoint'

type DrawStrokeOptions = {
  color: string
  dpr: number
  alpha?: number
  lineWidthOverride?: number
  dashPattern?: number[]
  dashOffset?: number
  view?: CanvasView
}

// Punkt startu jest zawsze miętowy — mówi „tu zacznij", więc nie zależy od koloru opaski.
const GUIDE_START = '#3ee6a8'


type RenderSceneOptions = {
  context: CanvasRenderingContext2D
  width: number
  height: number
  dpr: number
  referenceStrokes: Stroke[]
  /** Od dołu do góry: layers[0] jest najniżej. */
  layers: Layer[]
  layerCanvases: Map<string, HTMLCanvasElement>
  activeStroke: Stroke | null
  referenceStrokeColor: string
  userStrokeColor: string
  view?: CanvasView
  /** Faza wędrującego kreskowania wzorca, w pikselach rysunku. */
  guideDashOffset?: number
}

type ReplayLayerOptions = {
  color: string
  dpr: number
  width: number
  height: number
  view?: CanvasView
}

// Grubość zostaje w jednostkach rysunku, więc transformacja ją skaluje: przybliżony
// tusz jest grubszy, tak jak w każdym programie graficznym.
function applyView(context: CanvasRenderingContext2D, dpr: number, view: CanvasView): void {
  const k = dpr * view.scale
  context.setTransform(k, 0, 0, k, dpr * view.offsetX, dpr * view.offsetY)
}

/** Czyszczenie musi iść w pikselach urządzenia — po przesunięciu widoku
 *  clearRect w układzie rysunku nie pokrywa już całego płótna. */
function clearAll(context: CanvasRenderingContext2D, width: number, height: number, dpr: number): void {
  context.setTransform(1, 0, 0, 1, 0, 0)
  context.globalCompositeOperation = 'source-over'
  context.globalAlpha = 1
  context.clearRect(0, 0, Math.ceil(width * dpr) + 1, Math.ceil(height * dpr) + 1)
}

function configureContext(
  context: CanvasRenderingContext2D,
  dpr: number,
  view: CanvasView,
  color: string,
  lineWidth: number,
  alpha: number,
): void {
  applyView(context, dpr, view)
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.strokeStyle = color
  context.fillStyle = color
  context.lineWidth = lineWidth
  context.globalAlpha = alpha
  context.setLineDash([])
  context.lineDashOffset = 0
}

export function drawStroke(
  context: CanvasRenderingContext2D,
  stroke: Stroke,
  options: DrawStrokeOptions,
): void {
  if (stroke.points.length === 0) {
    return
  }

  const lineWidth = options.lineWidthOverride ?? stroke.brushSize
  const alpha = options.alpha ?? 1
  const view = options.view ?? IDENTITY_VIEW

  configureContext(context, options.dpr, view, options.color, lineWidth, alpha)

  if (options.dashPattern) {
    context.setLineDash(options.dashPattern)
    context.lineDashOffset = options.dashOffset ?? 0
  }

  const points = stroke.points

  if (points.length === 1) {
    context.beginPath()
    context.arc(points[0].x, points[0].y, lineWidth / 2, 0, Math.PI * 2)
    context.fill()
    return
  }

  context.beginPath()
  context.moveTo(points[0].x, points[0].y)

  if (points.length === 2) {
    context.lineTo(points[1].x, points[1].y)
  } else {
    // Draw smooth curve through midpoints between consecutive points
    let mx = (points[0].x + points[1].x) / 2
    let my = (points[0].y + points[1].y) / 2
    context.lineTo(mx, my)
    for (let i = 1; i < points.length - 1; i++) {
      const nmx = (points[i].x + points[i + 1].x) / 2
      const nmy = (points[i].y + points[i + 1].y) / 2
      context.quadraticCurveTo(points[i].x, points[i].y, nmx, nmy)
    }
    context.lineTo(points[points.length - 1].x, points[points.length - 1].y)
  }

  context.stroke()
}

/**
 * Kreska aktualnego kroku. Ma krzyczeć „zrób to teraz", więc dostaje trzy warstwy:
 * szeroką poświatę, wyraźną linię z wędrującym kreskowaniem i kropkę w punkcie startu.
 *
 * Kropka startu nie jest ozdobą: evaluateStroke wykrywa kreskę narysowaną od złego
 * końca i obniża za to ocenę, więc użytkownik musi wiedzieć, gdzie zaczynać.
 */
export function drawGuideStroke(
  context: CanvasRenderingContext2D,
  stroke: Stroke,
  options: { color: string; dpr: number; view?: CanvasView; dashOffset?: number },
): void {
  if (stroke.points.length === 0) return

  const { color, dpr, view = IDENTITY_VIEW, dashOffset = 0 } = options

  // Opaska pod aktywną kreską: fiolet, krycie .35, grubość 14 — wartości z projektu.
  drawStroke(context, stroke, {
    color,
    dpr,
    view,
    alpha: 0.4,
    lineWidthOverride: 16,
  })

  // Wędrujące kreskowanie zostaje — użytkownik chciał je zachować.
  drawStroke(context, stroke, {
    color,
    dpr,
    view,
    alpha: 0.9,
    dashPattern: [11, 9],
    // Ujemne, żeby kreskowanie wędrowało w stronę rysowania, nie przeciwnie.
    dashOffset: -dashOffset,
  })

  // Punkt startu jest miętowy, bo mówi „tu zacznij", a nie „tu jest błąd".
  const start = stroke.points[0]
  configureContext(context, dpr, view, GUIDE_START, 1, 1)
  context.beginPath()
  context.arc(start.x, start.y, 7, 0, Math.PI * 2)
  context.fill()
  context.globalAlpha = 1
}

/** Wymazanie: krycie pełne, bo `destination-out` zabiera tyle alfy, ile sam ma. */
function applyStamps(
  context: CanvasRenderingContext2D,
  stamps: EraseStamp[] | undefined,
  dpr: number,
  view: CanvasView,
): void {
  if (!stamps || stamps.length === 0) return

  applyView(context, dpr, view)
  context.globalCompositeOperation = 'destination-out'
  context.globalAlpha = 1
  context.setLineDash([])
  context.fillStyle = '#000000'

  for (const stamp of stamps) {
    context.beginPath()
    context.arc(stamp.x, stamp.y, stamp.r, 0, Math.PI * 2)
    context.fill()
  }

  context.globalCompositeOperation = 'source-over'
}

/**
 * Odtwarza bitmapę warstwy z jej operacji: kreski po kolei, a stemple wymazania
 * wplecione tam, gdzie powstały. Stemple zawsze na końcu wymazywałyby kreskę
 * poprowadzoną przez wcześniejszą dziurę, co jest widoczne i błędne.
 */
export function replayLayer(
  context: CanvasRenderingContext2D,
  layer: Layer,
  { color, dpr, width, height, view = IDENTITY_VIEW }: ReplayLayerOptions,
): void {
  clearAll(context, width, height, dpr)

  const stampsAfter = new Map<number, EraseStamp[]>()
  for (const stamp of layer.erases) {
    // Stempel spoza zakresu (np. po cofnięciu kresek) przypinamy do końca.
    const key = Math.max(0, Math.min(stamp.afterStroke, layer.strokes.length))
    const existing = stampsAfter.get(key)
    if (existing) existing.push(stamp)
    else stampsAfter.set(key, [stamp])
  }

  applyStamps(context, stampsAfter.get(0), dpr, view)
  for (let index = 0; index < layer.strokes.length; index += 1) {
    // Kolor z kreski wygrywa: zmiana pędzla nie przemalowuje starych linii.
    const stroke = layer.strokes[index]
    drawStroke(context, stroke, {
      color: stroke.color ?? color,
      alpha: stroke.opacity ?? 1,
      dpr,
      view,
    })
    applyStamps(context, stampsAfter.get(index + 1), dpr, view)
  }

  context.globalAlpha = 1
}

/** Składa gotowe bitmapy warstw. Bitmapy są w pikselach urządzenia, więc transformacja tożsamościowa. */
export function compositeLayers(
  context: CanvasRenderingContext2D,
  layers: Layer[],
  layerCanvases: Map<string, HTMLCanvasElement>,
): void {
  context.setTransform(1, 0, 0, 1, 0, 0)
  context.globalCompositeOperation = 'source-over'

  for (const layer of layers) {
    if (!layer.visible || layer.opacity <= 0) continue
    const source = layerCanvases.get(layer.id)
    if (!source || source.width === 0 || source.height === 0) continue
    context.globalAlpha = Math.min(1, layer.opacity)
    context.drawImage(source, 0, 0)
  }

  context.globalAlpha = 1
}

export function renderCanvasScene({
  context,
  width,
  height,
  dpr,
  referenceStrokes,
  layers,
  layerCanvases,
  activeStroke,
  referenceStrokeColor,
  userStrokeColor,
  view = IDENTITY_VIEW,
  guideDashOffset = 0,
}: RenderSceneOptions): void {
  clearAll(context, width, height, dpr)

  for (const stroke of referenceStrokes) {
    drawGuideStroke(context, stroke, {
      color: referenceStrokeColor,
      dpr,
      view,
      dashOffset: guideDashOffset,
    })
  }

  compositeLayers(context, layers, layerCanvases)

  if (activeStroke) {
    drawStroke(context, activeStroke, {
      color: activeStroke.color ?? userStrokeColor,
      alpha: activeStroke.opacity ?? 1,
      dpr,
      view,
    })
  }

  context.globalAlpha = 1
}
