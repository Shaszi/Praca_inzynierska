import type { ContourPoint } from '../contours'
import { chainConnections, type Connection } from './connections'

export type Part = { id: string; name: string; contours: ContourPoint[][] }

export type FaceConnectionSets = {
  oval: Connection[]
  leftEyebrow: Connection[]
  rightEyebrow: Connection[]
  leftEye: Connection[]
  rightEye: Connection[]
  leftIris: Connection[]
  rightIris: Connection[]
  lips: Connection[]
}

// Indeksy siatki MediaPipe Face Mesh: grzbiet nosa (między brwiami → czubek) i dół nosa
// (skrzydełko → nozdrza → skrzydełko). Zestawów połączeń dla nosa biblioteka nie ma.
const NOSE_BRIDGE = [168, 6, 197, 195, 5, 4]
const NOSE_BASE = [64, 98, 97, 2, 326, 327, 294]

type Landmark = { x: number; y: number }

const meanX = (points: ContourPoint[]) => points.reduce((sum, p) => sum + p.x, 0) / points.length
const meanY = (points: ContourPoint[]) => points.reduce((sum, p) => sum + p.y, 0) / points.length

function circle(loop: ContourPoint[], segments = 28, radiusScale = 1): ContourPoint[] {
  const last = loop[loop.length - 1]
  const points = loop.length > 1 && last.x === loop[0].x && last.y === loop[0].y ? loop.slice(0, -1) : loop
  const cx = meanX(points)
  const cy = meanY(points)
  const r = (radiusScale * points.reduce((sum, p) => sum + Math.hypot(p.x - cx, p.y - cy), 0)) / points.length
  return Array.from({ length: segments + 1 }, (_, i) => {
    const a = (i / segments) * Math.PI * 2
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
  })
}

/** Dzieli zamkniętą pętlę w punktach skrajnych w poziomie na dwie łuki: górny i dolny. */
function splitLoop(loop: ContourPoint[]): { upper: ContourPoint[]; lower: ContourPoint[] } {
  const ring = loop.slice(0, -1)
  let left = 0
  let right = 0
  ring.forEach((p, i) => {
    if (p.x < ring[left].x) left = i
    if (p.x > ring[right].x) right = i
  })
  const arc = (from: number, to: number) => {
    const out: ContourPoint[] = []
    for (let i = from; ; i = (i + 1) % ring.length) {
      out.push(ring[i])
      if (i === to) return out
    }
  }
  const a = arc(left, right)
  const b = arc(right, left)
  return meanY(a) <= meanY(b) ? { upper: a, lower: b } : { upper: b, lower: a }
}

export function faceParts(landmarks: Landmark[], width: number, height: number, sets: FaceConnectionSets): Part[] {
  const toPoint = (index: number): ContourPoint => ({ x: landmarks[index].x * width, y: landmarks[index].y * height })
  const lines = (connections: Connection[]) => chainConnections(connections).map((path) => path.map(toPoint))
  const longest = (connections: Connection[]) =>
    lines(connections).sort((a, b) => b.length - a.length)[0] ?? []

  const sided = (name: string, a: ContourPoint[][], b: ContourPoint[][], id: string): Part[] => {
    const [first, second] = meanX(a.flat()) <= meanX(b.flat()) ? [a, b] : [b, a]
    return [
      { id: `${id}-left`, name: `${name} — lewa strona`, contours: first },
      { id: `${id}-right`, name: `${name} — prawa strona`, contours: second },
    ]
  }

  // Oko jako dwie powieki — górna i dolna rysuje się osobno, inną kreską.
  const lids = (loop: ContourPoint[]) => {
    if (loop.length < 4) return [loop]
    const { upper, lower } = splitLoop(loop)
    return [upper, lower]
  }
  const oval = splitLoop(longest(sets.oval))
  const lipLoops = lines(sets.lips).sort((a, b) => b.length - a.length)
  const [outerLips, innerLips] = [lipLoops[0] ?? [], lipLoops[1] ?? []]
  const inner = innerLips.length > 3 ? splitLoop(innerLips) : null
  // Usta zamknięte: wewnętrzna pętla to jedna linia przebyta dwa razy — rysujemy ją raz.
  const mouthOpen = inner && Math.abs(meanY(inner.lower) - meanY(inner.upper)) > 0.15 * Math.abs(meanY(oval.lower) - meanY(oval.upper))

  return [
    { id: 'jaw', name: 'Linia szczęki i podbródek', contours: [oval.lower] },
    { id: 'forehead', name: 'Linia czoła', contours: [oval.upper] },
    ...sided('Brew', lines(sets.leftEyebrow), lines(sets.rightEyebrow), 'brow'),
    ...sided('Oko', lids(longest(sets.leftEye)), lids(longest(sets.rightEye)), 'eye'),
    ...sided(
      'Tęczówka',
      [circle(longest(sets.leftIris)), circle(longest(sets.leftIris), 20, 0.45)],
      [circle(longest(sets.rightIris)), circle(longest(sets.rightIris), 20, 0.45)],
      'iris',
    ),
    { id: 'nose', name: 'Nos', contours: [NOSE_BRIDGE.map(toPoint), NOSE_BASE.map(toPoint)] },
    {
      id: 'mouth',
      name: 'Usta',
      contours: [outerLips, ...(inner ? (mouthOpen ? [inner.upper, inner.lower] : [inner.upper]) : [])].filter(
        (line) => line.length > 1,
      ),
    },
  ].filter((part) => part.contours.some((line) => line.length > 1))
}
