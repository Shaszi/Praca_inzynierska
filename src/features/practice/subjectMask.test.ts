import { describe, expect, it } from 'vitest'
import { extractContours } from './contours'
import { isolateSubject, maskContains, maskCoverage, maskFromCategory, polygonMask } from './subjectMask'

describe('maskFromCategory', () => {
  it('bierze jako obiekt wartość pod punktem stuknięcia', () => {
    const mask = maskFromCategory(new Uint8Array([7, 7, 0, 0]), 4, 1, 0, 0.5)
    expect([...mask.data]).toEqual([1, 1, 0, 0])
    expect(maskCoverage(mask)).toBe(0.5)

    const other = maskFromCategory(new Uint8Array([7, 7, 0, 0]), 4, 1, 1, 0.5)
    expect([...other.data]).toEqual([0, 0, 1, 1])
  })
})

describe('isolateSubject', () => {
  it('usuwa krawędzie tła, a zostawia obrys obiektu', () => {
    const width = 120
    const height = 120
    const pixels = new Uint8ClampedArray(width * height * 4).fill(255)
    const paint = (x0: number, y0: number, x1: number, y1: number) => {
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const p = (y * width + x) * 4
          pixels[p] = pixels[p + 1] = pixels[p + 2] = 0
        }
      }
    }
    paint(10, 10, 50, 50)
    paint(75, 70, 110, 110)

    const mask = { data: new Uint8Array(60 * 60), width: 60, height: 60 }
    for (let y = 3; y < 27; y++) for (let x = 3; x < 27; x++) mask.data[y * 60 + x] = 1

    const all = extractContours(pixels, width, height)
    const isolated = extractContours(isolateSubject(pixels, width, height, mask), width, height)
    const touchesBackground = (contours: { x: number; y: number }[][]) =>
      contours.some((contour) => contour.some((p) => p.x > 65 && p.y > 65))

    expect(touchesBackground(all)).toBe(true)
    expect(isolated.length).toBeGreaterThan(0)
    expect(touchesBackground(isolated)).toBe(false)
  })
})

describe('polygonMask', () => {
  it('wypełnia wnętrze pętli, a zostawia zewnątrz', () => {
    const mask = polygonMask(
      [{ x: 10, y: 10 }, { x: 90, y: 10 }, { x: 90, y: 50 }, { x: 10, y: 50 }],
      100,
      60,
    )
    const inside = maskContains(mask, 100, 60)
    expect(mask.soft).toBe(true)
    expect(inside(50, 30)).toBe(true)
    expect(inside(5, 30)).toBe(false)
    expect(inside(50, 55)).toBe(false)
    expect(maskCoverage(mask)).toBeCloseTo((80 * 40) / (100 * 60), 1)
  })

  it('z lassa zostają krawędzie z wnętrza, bez linii samego lassa i bez tła', () => {
    const width = 160
    const height = 100
    const pixels = new Uint8ClampedArray(width * height * 4).fill(255)
    const paint = (x0: number, y0: number, x1: number, y1: number) => {
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const p = (y * width + x) * 4
          pixels[p] = pixels[p + 1] = pixels[p + 2] = 0
        }
      }
    }
    paint(20, 20, 60, 60)
    paint(110, 20, 150, 60)

    const lasso = polygonMask([{ x: 8, y: 8 }, { x: 75, y: 8 }, { x: 75, y: 75 }, { x: 8, y: 75 }], width, height)
    const contours = extractContours(pixels, width, height, { keep: maskContains(lasso, width, height) })

    expect(contours.length).toBeGreaterThan(0)
    expect(contours.every((c) => c.every((p) => p.x > 12 && p.x < 70 && p.y > 12 && p.y < 70))).toBe(true)
  })
})
