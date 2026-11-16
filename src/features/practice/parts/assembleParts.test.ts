import { describe, expect, it } from 'vitest'
import { assembleFromRegions, assembleParts, CATEGORY, type CategoryMask } from './assembleParts'
import type { Part } from './faceParts'

const W = 600
const H = 800

const ellipse = (cx: number, cy: number, rx: number, ry: number, n = 40, from = 0, to = Math.PI * 2) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = from + ((to - from) * i) / n
    return { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) }
  })

const face: Part[] = [
  { id: 'jaw', name: 'Linia szczęki i podbródek', contours: [ellipse(300, 400, 150, 200, 40, 0, Math.PI)] },
  { id: 'forehead', name: 'Linia czoła', contours: [ellipse(300, 400, 150, 200, 40, Math.PI, Math.PI * 2)] },
  { id: 'eye-left', name: 'Oko — lewa strona', contours: [ellipse(240, 360, 30, 12)] },
  { id: 'eye-right', name: 'Oko — prawa strona', contours: [ellipse(360, 360, 30, 12)] },
  { id: 'mouth', name: 'Usta', contours: [ellipse(300, 500, 50, 14)] },
]

function categories(): CategoryMask {
  const data = new Uint8Array(W * H)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const inFace = ((x - 300) / 150) ** 2 + ((y - 400) / 200) ** 2 <= 1
      if (y < 330 && Math.abs(x - 300) < 190 && y > 120) data[y * W + x] = CATEGORY.hair
      else if (inFace) data[y * W + x] = CATEGORY.faceSkin
      else if (y > 600 && x > 100 && x < 500) data[y * W + x] = CATEGORY.clothes
    }
  }
  return { data, width: W, height: H }
}

function pixels() {
  const rgba = new Uint8ClampedArray(W * H * 4).fill(200)
  for (let y = 180; y < 300; y++) {
    for (let x = 250; x < 256; x++) {
      const p = (y * W + x) * 4
      rgba[p] = rgba[p + 1] = rgba[p + 2] = 40
    }
  }
  for (let y = 336; y < 339; y++) {
    for (let x = 215; x < 266; x++) {
      const p = (y * W + x) * 4
      rgba[p] = rgba[p + 1] = rgba[p + 2] = 120
    }
  }
  return rgba
}

describe('assembleParts', () => {
  const steps = assembleParts({ pixels: pixels(), width: W, height: H, face, categories: categories(), selection: null })
  const parts = [...new Set(steps.map((step) => step.part.id))]

  it('układa części w kolejności rysowania portretu', () => {
    const at = (id: string) => parts.indexOf(id)
    expect(at('jaw')).toBe(0)
    expect(at('hair-outline')).toBeGreaterThan(at('jaw'))
    expect(at('eye-left')).toBeGreaterThan(at('hair-outline'))
    expect(at('mouth')).toBeGreaterThan(at('eye-right'))
    expect(at('hair-strands')).toBeGreaterThan(at('mouth'))
  })

  it('oczy i usta zawsze trafiają do kursu', () => {
    for (const id of ['eye-left', 'eye-right', 'mouth']) expect(parts).toContain(id)
  })

  it('czoło schowane pod włosami wypada', () => {
    expect(parts).not.toContain('forehead')
  })

  it('kosmyk ze zdjęcia trafia do części z włosami', () => {
    const strands = steps.filter((step) => step.part.id === 'hair-strands')
    expect(strands.length).toBeGreaterThan(0)
    expect(strands.every((step) => step.points.every((p) => p.y > 120 && p.y < 335))).toBe(true)
  })

  it('sylwetka nie dubluje linii szczęki', () => {
    const silhouette = steps.filter((step) => step.part.id === 'silhouette').flatMap((step) => step.points)
    const onJaw = silhouette.filter((p) => Math.abs(((p.x - 300) / 150) ** 2 + ((p.y - 400) / 200) ** 2 - 1) < 0.02 && p.y > 420)
    expect(onJaw.length).toBe(0)
  })

  it('załamanie powieki ze zdjęcia trafia do części oka jako osobny krok', () => {
    const eye = steps.filter((step) => step.part.id === 'eye-left')
    expect(eye.length).toBeGreaterThanOrEqual(2)
    expect(eye.some((step) => step.points.every((p) => p.y > 330 && p.y < 345))).toBe(true)
  })
})

describe('assembleFromRegions', () => {
  // Rysunek bez twarzy dla MediaPipe: dwa „oczy” jako ciemne elipsy na jasnym tle.
  function drawing(): Uint8ClampedArray {
    const pixels = new Uint8ClampedArray(W * H * 4).fill(255)
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const inEye = [240, 360].some((cx) => ((x - cx) / 30) ** 2 + ((y - 360) / 12) ** 2 <= 1)
        if (inEye) pixels.fill(20, (y * W + x) * 4, (y * W + x) * 4 + 3)
      }
    }
    return pixels
  }

  it('dokłada linie oczu z ramek, nawet gdy zwykły plan ich nie ma', () => {
    const steps = assembleFromRegions({
      pixels: drawing(),
      width: W,
      height: H,
      regions: [
        { id: 'eye-left', name: 'Oko — lewa strona', box: { minX: 190, minY: 330, maxX: 290, maxY: 390 } },
        { id: 'eye-right', name: 'Oko — prawa strona', box: { minX: 310, minY: 330, maxX: 410, maxY: 390 } },
      ],
      base: [{ points: ellipse(300, 400, 150, 200), role: 'outline', part: { id: 'outline', name: 'Obrys' } }],
    })
    const parts = steps.map((step) => step.part.id)
    expect(parts[0]).toBe('outline')
    expect(parts).toContain('eye-left')
    expect(parts).toContain('eye-right')
  })
})
