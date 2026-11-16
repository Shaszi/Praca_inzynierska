import { describe, expect, it } from 'vitest'
import { extractContours, pathLength, removeOverlaps, simplify, toGrayscale, traceChains } from './contours'

/** Płótno RGBA wypełnione bielą, na którym można postawić czarne piksele. */
function canvas(width: number, height: number) {
  const data = new Uint8ClampedArray(width * height * 4).fill(255)
  return {
    data,
    rect(x0: number, y0: number, x1: number, y1: number) {
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const p = (y * width + x) * 4
          data[p] = data[p + 1] = data[p + 2] = 0
        }
      }
      return this
    },
  }
}

describe('toGrayscale', () => {
  it('biel to 255, czerń to 0', () => {
    const gray = toGrayscale(new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255]), 2, 1)
    expect(Math.round(gray[0])).toBe(255)
    expect(Math.round(gray[1])).toBe(0)
  })
})

describe('simplify', () => {
  it('z prostej zostawia dwa końce', () => {
    const line = Array.from({ length: 20 }, (_, i) => ({ x: i, y: 0 }))
    expect(simplify(line, 1)).toEqual([{ x: 0, y: 0 }, { x: 19, y: 0 }])
  })

  it('zachowuje załamanie', () => {
    const bent = [
      { x: 0, y: 0 },
      { x: 5, y: 10 },
      { x: 10, y: 0 },
    ]
    expect(simplify(bent, 1)).toHaveLength(3)
  })

  it('nie rusza odcinka krótszego niż trzy punkty', () => {
    const two = [{ x: 0, y: 0 }, { x: 3, y: 4 }]
    expect(simplify(two, 10)).toEqual(two)
  })
})

describe('traceChains', () => {
  it('idzie wzdłuż łańcucha, nie w poprzek', () => {
    // Pozioma linia krawędziowa w siatce 6x3.
    const edges = new Uint8Array(18)
    for (let x = 1; x <= 4; x++) edges[6 + x] = 1
    const [chain] = traceChains(edges, 6, 3)
    expect(chain.map((p) => p.x)).toEqual([1, 2, 3, 4])
    expect(chain.every((p) => p.y === 1)).toBe(true)
  })

  it('odwiedza każdy piksel krawędzi dokładnie raz', () => {
    const edges = new Uint8Array(25)
    for (const i of [6, 7, 8, 11, 16, 17, 18]) edges[i] = 1
    const total = traceChains(edges, 5, 5).reduce((sum, chain) => sum + chain.length, 0)
    expect(total).toBe(7)
  })
})

describe('extractContours', () => {
  it('z prostokąta robi obrys, a nie wypełnienie', () => {
    const { data } = canvas(80, 60).rect(20, 15, 60, 45)
    const contours = extractContours(data, 80, 60, { minLengthPx: 10 })

    expect(contours.length).toBeGreaterThan(0)
    // Obrys prostokąta 40x30 ma obwód 140; wypełnienie dałoby wielokrotnie więcej punktów.
    const longest = contours[0]
    expect(pathLength(longest)).toBeGreaterThan(100)
    expect(longest.length).toBeLessThan(40)

    // Każdy punkt leży przy krawędzi prostokąta, nie w jego środku.
    for (const point of longest) {
      const nearEdge =
        Math.abs(point.x - 20) <= 2 ||
        Math.abs(point.x - 59) <= 2 ||
        Math.abs(point.y - 15) <= 2 ||
        Math.abs(point.y - 44) <= 2
      expect(nearEdge, `punkt ${point.x},${point.y} jest w środku figury`).toBe(true)
    }
  })

  it('na jednolitym tle nie znajduje niczego', () => {
    const { data } = canvas(40, 40)
    expect(extractContours(data, 40, 40)).toEqual([])
  })

  it('zwraca kontury od najdłuższego', () => {
    const { data } = canvas(120, 80).rect(10, 10, 70, 60).rect(85, 20, 100, 35)
    const contours = extractContours(data, 120, 80, { minLengthPx: 10 })
    const lengths = contours.map(pathLength)
    expect(lengths).toEqual([...lengths].sort((a, b) => b - a))
  })

  it('trzyma się limitu konturów', () => {
    const shape = canvas(200, 200)
    for (let i = 0; i < 20; i++) shape.rect(i * 9 + 2, 5, i * 9 + 7, 190)
    expect(extractContours(shape.data, 200, 200, { maxContours: 5 }).length).toBeLessThanOrEqual(5)
  })
})

describe('removeOverlaps', () => {
  const line = (y: number, x0: number, x1: number) => Array.from({ length: x1 - x0 }, (_, i) => ({ x: x0 + i, y }))

  it('z dwóch równoległych linii zostawia dłuższą', () => {
    const kept = removeOverlaps([line(10, 0, 80), line(13, 0, 100)], 120, 40, 5, 20)
    expect(kept).toHaveLength(1)
    expect(kept[0]).toHaveLength(100)
  })

  it('krzyżująca się linia traci tylko kawałek przy skrzyżowaniu', () => {
    const vertical = Array.from({ length: 100 }, (_, i) => ({ x: 50, y: i }))
    const kept = removeOverlaps([line(50, 0, 100), vertical], 100, 100, 4, 20)
    // Pozioma w całości, pionowa w dwóch kawałkach rozdzielonych luką przy przecięciu.
    expect(kept).toHaveLength(3)
    expect(kept.slice(1).every((part) => part.every((p) => Math.abs(p.y - 50) > 4))).toBe(true)
  })

  it('pętla tam i z powrotem staje się jedną linią', () => {
    const loop = [...line(20, 0, 100), ...line(23, 0, 100).reverse()]
    const kept = removeOverlaps([loop], 120, 40, 5, 20)
    expect(kept.reduce((sum, part) => sum + pathLength(part), 0)).toBeLessThan(120)
  })

  it('cienki pasek na zdjęciu daje jedną linię, a nie dwie', () => {
    const image = canvas(160, 60).rect(20, 28, 140, 31)
    const total = extractContours(image.data, 160, 60).reduce((sum, c) => sum + pathLength(c), 0)
    // Pasek ma 120 px; dwa brzegi dałyby ~240.
    expect(total).toBeLessThan(170)
  })
})
