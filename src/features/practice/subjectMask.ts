
export type SubjectMask = { data: Uint8Array; width: number; height: number; soft?: boolean }

/**
 * Z maski kategorii segmentera wybiera obszar, w który stuknął użytkownik. Nie zakładamy,
 * jaka wartość znaczy „obiekt" — bierzemy wartość pod palcem, bo segmenter z definicji
 * zaznacza to, co jest w punkcie stuknięcia.
 */
export function maskFromCategory(
  category: Uint8Array,
  width: number,
  height: number,
  tapX: number,
  tapY: number,
): SubjectMask {
  const x = Math.min(width - 1, Math.max(0, Math.round(tapX * (width - 1))))
  const y = Math.min(height - 1, Math.max(0, Math.round(tapY * (height - 1))))
  const picked = category[y * width + x]
  const data = new Uint8Array(width * height)
  for (let i = 0; i < data.length; i++) data[i] = category[i] === picked ? 1 : 0
  return { data, width, height }
}

export function maskCoverage(mask: SubjectMask): number {
  let sum = 0
  for (const value of mask.data) sum += value
  return sum / mask.data.length
}

export function isolateSubject(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  mask: SubjectMask,
): Uint8ClampedArray {
  const inside = (x: number, y: number) =>
    mask.data[Math.floor((y * mask.height) / height) * mask.width + Math.floor((x * mask.width) / width)] === 1

  let luminance = 0
  let count = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!inside(x, y)) continue
      const p = (y * width + x) * 4
      luminance += 0.299 * pixels[p] + 0.587 * pixels[p + 1] + 0.114 * pixels[p + 2]
      count++
    }
  }
  const fill = count > 0 && luminance / count > 128 ? 0 : 255

  const out = new Uint8ClampedArray(pixels)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (inside(x, y)) continue
      const p = (y * width + x) * 4
      out[p] = out[p + 1] = out[p + 2] = fill
      out[p + 3] = 255
    }
  }
  return out
}

const LASSO_MASK_MAX = 512

export function polygonMask(points: { x: number; y: number }[], width: number, height: number): SubjectMask {
  const scale = Math.min(1, LASSO_MASK_MAX / Math.max(width, height))
  const mw = Math.max(1, Math.round(width * scale))
  const mh = Math.max(1, Math.round(height * scale))
  const data = new Uint8Array(mw * mh)
  const poly = points.map((p) => ({ x: p.x * scale, y: p.y * scale }))

  for (let y = 0; y < mh; y++) {
    const cy = y + 0.5
    const xs: number[] = []
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i]
      const b = poly[(i + 1) % poly.length]
      if ((a.y <= cy && b.y > cy) || (b.y <= cy && a.y > cy)) xs.push(a.x + ((cy - a.y) / (b.y - a.y)) * (b.x - a.x))
    }
    xs.sort((p, q) => p - q)
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const from = Math.max(0, Math.ceil(xs[k] - 0.5))
      const to = Math.min(mw - 1, Math.floor(xs[k + 1] - 0.5))
      for (let x = from; x <= to; x++) data[y * mw + x] = 1
    }
  }
  return { data, width: mw, height: mh, soft: true }
}

export function maskContains(mask: SubjectMask, width: number, height: number): (x: number, y: number) => boolean {
  return (x, y) =>
    mask.data[Math.floor((y * mask.height) / height) * mask.width + Math.floor((x * mask.width) / width)] === 1
}
