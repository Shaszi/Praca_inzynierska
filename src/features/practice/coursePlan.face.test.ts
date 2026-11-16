import { describe, expect, it } from 'vitest'
import { extractContours, SELECTION_EDGE_QUANTILE } from './contours'
import { planCourse } from './coursePlan'
import { isolateSubject, type SubjectMask } from './subjectMask'

const W = 1512
const H = 2016

function face() {
  const pixels = new Uint8ClampedArray(W * H * 4).fill(235)
  const mask: SubjectMask = { data: new Uint8Array(W * H), width: W, height: H }
  const ellipse = (cx: number, cy: number, rx: number, ry: number, shade: number, toMask = false) => {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
      for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 > 1) continue
        const p = (y * W + x) * 4
        pixels[p] = pixels[p + 1] = pixels[p + 2] = shade
        if (toMask) mask.data[y * W + x] = 1
      }
    }
  }
  ellipse(756, 1000, 420, 560, 190, true)
  for (const cx of [590, 922]) {
    ellipse(cx, 820, 85, 22, 60)
    ellipse(cx, 900, 80, 34, 225)
    ellipse(cx, 900, 26, 26, 40)
  }
  ellipse(756, 1080, 34, 70, 150)
  ellipse(756, 1260, 130, 30, 110)
  return { pixels, mask }
}

describe('kurs z twarzy', () => {
  it('zostawia oczy, tęczówki, brwi, nos i usta', () => {
    const { pixels, mask } = face()
    const contours = extractContours(isolateSubject(pixels, W, H, mask), W, H, { edgeQuantile: SELECTION_EDGE_QUANTILE })
    const plan = planCourse(contours, W, H, mask)

    const near = (cx: number, cy: number) =>
      Math.min(
        ...plan.flatMap((step) =>
          step.points.slice(1).map((b, i) => {
            const a = step.points[i]
            const len2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2 || 1
            const t = Math.max(0, Math.min(1, ((cx - a.x) * (b.x - a.x) + (cy - a.y) * (b.y - a.y)) / len2))
            return Math.hypot(cx - (a.x + t * (b.x - a.x)), cy - (a.y + t * (b.y - a.y)))
          }),
        ),
      )

    expect(near(590, 874), 'lewa tęczówka').toBeLessThan(5)
    expect(near(922, 926), 'prawa tęczówka').toBeLessThan(5)
    expect(near(590, 866), 'powieka').toBeLessThan(5)
    expect(near(590, 842), 'lewa brew').toBeLessThan(5)
    expect(near(756, 1010), 'nos').toBeLessThan(5)
    expect(near(756, 1230), 'usta').toBeLessThan(5)
  })
})
