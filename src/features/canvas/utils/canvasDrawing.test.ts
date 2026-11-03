import { describe, expect, it } from 'vitest'
import type { EraseStamp, Layer, Point, Stroke } from '../../../types/drawing'
import { replayLayer } from './canvasDrawing'

// Atrapa kontekstu 2D: jsdom nie ma canvasa, a replayLayer jest czystą funkcją nad kontekstem.
// Zapisujemy tylko operacje istotne dla kolejności: rysowanie kreski i stempel wymazania.
type Op = 'clear' | 'draw' | 'erase'

function fakeContext() {
  const ops: Op[] = []
  const context = {
    globalCompositeOperation: 'source-over',
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    lineCap: '',
    lineJoin: '',
    setTransform: () => {},
    setLineDash: () => {},
    clearRect: () => ops.push('clear'),
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    quadraticCurveTo: () => {},
    arc: () => {},
    stroke: () => ops.push('draw'),
    fill: () => {
      // Kreska jednopunktowa też używa fill(), więc rozstrzyga tryb mieszania.
      ops.push(context.globalCompositeOperation === 'destination-out' ? 'erase' : 'draw')
    },
  }
  return { context, ops }
}

const point = (x: number, y: number): Point => ({ x, y, timestamp: 0 })
// Dwa punkty: drawStroke użyje stroke(), nie fill() — kolejność czyta się jednoznacznie.
const line = (offset: number): Stroke => ({ brushSize: 4, points: [point(offset, 0), point(offset + 10, 0)] })

const layerOf = (strokes: Stroke[], erases: EraseStamp[]): Layer => ({
  id: 'l1',
  name: 'Warstwa',
  visible: true,
  opacity: 1,
  strokes,
  erases,
})

const options = { color: '#000000', dpr: 1, width: 100, height: 100 }

function run(layer: Layer) {
  const { context, ops } = fakeContext()
  replayLayer(context as unknown as CanvasRenderingContext2D, layer, options)
  return ops
}

describe('replayLayer', () => {
  it('czyści bitmapę przed odtworzeniem', () => {
    expect(run(layerOf([], []))).toEqual(['clear'])
  })

  it('rysuje kreski w kolejności', () => {
    expect(run(layerOf([line(0), line(20)], []))).toEqual(['clear', 'draw', 'draw'])
  })

  it('wplata stempel tam, gdzie powstał — kreska przez starą dziurę przeżywa', () => {
    const erases: EraseStamp[] = [{ x: 5, y: 0, r: 3, afterStroke: 1 }]
    // Gdyby stemple szły zawsze na koniec, wyszłoby draw, draw, erase — i druga
    // kreska zostałaby wymazana razem z pierwszą.
    expect(run(layerOf([line(0), line(20)], erases))).toEqual(['clear', 'draw', 'erase', 'draw'])
  })

  it('stempel przed pierwszą kreską nie wymazuje nic późniejszego', () => {
    const erases: EraseStamp[] = [{ x: 5, y: 0, r: 3, afterStroke: 0 }]
    expect(run(layerOf([line(0)], erases))).toEqual(['clear', 'erase', 'draw'])
  })

  it('stempel spoza zakresu przypina się do końca', () => {
    const erases: EraseStamp[] = [{ x: 5, y: 0, r: 3, afterStroke: 99 }]
    expect(run(layerOf([line(0)], erases))).toEqual(['clear', 'draw', 'erase'])
  })

  it('wiele stempli w tym samym miejscu kolejności', () => {
    const erases: EraseStamp[] = [
      { x: 1, y: 0, r: 2, afterStroke: 1 },
      { x: 4, y: 0, r: 2, afterStroke: 1 },
    ]
    expect(run(layerOf([line(0), line(20)], erases))).toEqual(['clear', 'draw', 'erase', 'erase', 'draw'])
  })

  it('przywraca source-over, żeby kolejne rysowanie nie wymazywało', () => {
    const { context, ops } = fakeContext()
    replayLayer(
      context as unknown as CanvasRenderingContext2D,
      layerOf([line(0)], [{ x: 5, y: 0, r: 3, afterStroke: 1 }]),
      options,
    )
    expect(ops).toEqual(['clear', 'draw', 'erase'])
    expect(context.globalCompositeOperation).toBe('source-over')
    expect(context.globalAlpha).toBe(1)
  })
})
