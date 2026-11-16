
import type { Point, Stroke } from '../../../types/drawing'

export type Level = 'good' | 'warn' | 'bad'
export type SegmentKey = 'start' | 'middle' | 'end'
export type IssueKind = 'offset' | 'waver' | 'angle' | 'tremor' | 'pause'

export type Issue = {
  kind: IssueKind
  level: Level
  severity: number
  label: string
  sentence: string
}

export type SegmentReport = {
  key: SegmentKey
  level: Level
  offsetPx: number
  angleDeg: number
  tremorPx: number
  pauses: number
  issues: Issue[]
}

export type StrokeEvaluation = {
  tooShort: boolean
  score: number
  level: Level
  segments: SegmentReport[]
  lengthRatio: number
  startGapPx: number
  endGapPx: number
  speedPxPerSec: number
  reversed: boolean
  worstPoint: { x: number; y: number } | null
  summary: string
}

type Vec = { x: number; y: number }


const SAMPLES = 90
const COVERAGE_BINS = 48
const TREMOR_SPACING_PX = 2
const TREMOR_WINDOW = 4
const PAUSE_MOVE_PX = 3
const PAUSE_MS = 250

const TREMOR_GOOD = 0.7
const TREMOR_BAD = 1.4
const ANGLE_GOOD = 7
const ANGLE_BAD = 16
const LENGTH_GOOD = 0.07
const LENGTH_BAD = 0.18
const SLOWNESS_GOOD = 8
const SLOWNESS_BAD = 20

const LEVEL_RANK: Record<Level, number> = { good: 0, warn: 1, bad: 2 }
const ISSUE_PRIORITY: IssueKind[] = ['offset', 'waver', 'tremor', 'pause', 'angle']

const SEGMENTS: { key: SegmentKey; name: string; short: string }[] = [
  { key: 'start', name: 'Początek linii', short: 'początek' },
  { key: 'middle', name: 'Środek linii', short: 'środek' },
  { key: 'end', name: 'Koniec linii', short: 'koniec' },
]


const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y)

export function pathLength(points: Vec[]): number {
  let length = 0
  for (let i = 1; i < points.length; i++) length += dist(points[i - 1], points[i])
  return length
}

export function resampleCount(points: Vec[], n: number): Vec[] {
  const total = pathLength(points)
  if (points.length === 0) return []
  if (total === 0) return Array.from({ length: n }, () => ({ x: points[0].x, y: points[0].y }))

  const step = total / (n - 1)
  const out: Vec[] = [{ x: points[0].x, y: points[0].y }]
  let target = step
  let walked = 0
  for (let i = 1; i < points.length && out.length < n - 1; i++) {
    const a = points[i - 1]
    const b = points[i]
    const seg = dist(a, b)
    while (seg > 0 && walked + seg >= target && out.length < n - 1) {
      const t = (target - walked) / seg
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
      target += step
    }
    walked += seg
  }
  const last = points[points.length - 1]
  while (out.length < n) out.push({ x: last.x, y: last.y })
  return out
}

function resampleSpacing(points: Vec[], spacing: number): Vec[] {
  if (points.length < 2) return points.map((p) => ({ x: p.x, y: p.y }))
  const n = Math.max(2, Math.round(pathLength(points) / spacing) + 1)
  return resampleCount(points, n)
}

type Nearest = { point: Vec; distance: number; segmentIndex: number; beyondEnds: boolean }

function nearestOnPolyline(p: Vec, line: Vec[]): Nearest {
  let best: Nearest = { point: line[0], distance: dist(p, line[0]), segmentIndex: 0, beyondEnds: true }
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1]
    const b = line[i]
    const abx = b.x - a.x
    const aby = b.y - a.y
    const len2 = abx * abx + aby * aby
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2))
    const q = { x: a.x + abx * t, y: a.y + aby * t }
    const d = dist(p, q)
    if (d < best.distance) {
      const beyondEnds = (i === 1 && t === 0) || (i === line.length - 1 && t === 1)
      best = { point: q, distance: d, segmentIndex: i - 1, beyondEnds }
    }
  }
  return best
}

function angleBetween(u: Vec, v: Vec): number {
  const a = Math.atan2(u.y, u.x) - Math.atan2(v.y, v.x)
  const wrapped = Math.atan2(Math.sin(a), Math.cos(a))
  return Math.abs(wrapped) * (180 / Math.PI)
}


function grade(value: number, good: number, bad: number): { level: Level; score: number; severity: number } {
  const severity = (value - good) / (bad - good)
  if (value <= good) return { level: 'good', score: 1, severity }
  if (value < bad) return { level: 'warn', score: 1 - 0.6 * severity, severity }
  return { level: 'bad', score: Math.max(0, 0.4 - 0.4 * (value - bad) / bad), severity }
}

const worse = (a: Level, b: Level): Level => (a === 'bad' || b === 'bad' ? 'bad' : a === 'warn' || b === 'warn' ? 'warn' : 'good')

function directionWord(v: Vec): string {
  if (Math.abs(v.y) >= Math.abs(v.x)) return v.y < 0 ? 'w górę' : 'w dół'
  return v.x < 0 ? 'w lewo' : 'w prawo'
}

function thirdOf(p: Vec, smooth: Vec[]): number {
  let best = 0
  let bestDistance = Infinity
  for (let i = 0; i < smooth.length; i++) {
    const d = dist(p, smooth[i])
    if (d < bestDistance) {
      bestDistance = d
      best = i
    }
  }
  return Math.min(2, Math.floor((best / smooth.length) * 3))
}

function tremorByThird(raw: Vec[], smooth: Vec[]): number[] {
  const pts = resampleSpacing(raw, TREMOR_SPACING_PX)
  const sums = [0, 0, 0]
  const counts = [0, 0, 0]
  const k = TREMOR_WINDOW
  for (let i = k; i < pts.length - k; i++) {
    let sx = 0
    let sy = 0
    for (let j = -k; j <= k; j++) {
      sx += pts[i + j].x
      sy += pts[i + j].y
    }
    const avg = { x: sx / (2 * k + 1), y: sy / (2 * k + 1) }
    const third = thirdOf(pts[i], smooth)
    sums[third] += dist(pts[i], avg)
    counts[third] += 1
  }
  return sums.map((sum, i) => (counts[i] ? sum / counts[i] : 0))
}

function pausesByThird(raw: Point[], smooth: Vec[]): number[] {
  const result = [0, 0, 0]
  if (raw.length < 3) return result

  let anchor = 0
  for (let i = 1; i < raw.length; i++) {
    if (dist(raw[anchor], raw[i]) <= PAUSE_MOVE_PX) continue
    if (anchor > 0 && raw[i].timestamp - raw[anchor].timestamp > PAUSE_MS) {
      result[thirdOf(raw[anchor], smooth)] += 1
    }
    anchor = i
  }
  return result
}


function segmentIssues(
  name: string,
  offset: { px: number; vector: Vec; grade: ReturnType<typeof grade> },
  angle: { deg: number; grade: ReturnType<typeof grade> },
  tremor: { px: number; grade: ReturnType<typeof grade> },
  pauses: number,
): Issue[] {
  const issues: Issue[] = []
  const px = Math.round(offset.px)

  if (offset.grade.level !== 'good') {
    const wavers = Math.hypot(offset.vector.x, offset.vector.y) < 0.5 * offset.px
    const dir = directionWord(offset.vector)
    const bad = offset.grade.level === 'bad'
    issues.push(
      wavers
        ? {
            kind: 'waver',
            level: offset.grade.level,
            severity: offset.grade.severity,
            label: 'faluje',
            sentence: bad ? `${name} jest zły, bo faluje wokół wzoru.` : `${name} lekko faluje wokół wzoru.`,
          }
        : {
            kind: 'offset',
            level: offset.grade.level,
            severity: offset.grade.severity,
            label: `ucieka ${dir}`,
            sentence: bad
              ? `${name} jest zły, bo ucieka ${dir} o ok. ${px} px.`
              : `${name} lekko ucieka ${dir} (ok. ${px} px).`,
          },
    )
  }

  if (angle.grade.level !== 'good' && offset.grade.level === 'good') {
    const deg = Math.round(angle.deg)
    issues.push({
      kind: 'angle',
      level: angle.grade.level,
      severity: angle.grade.severity,
      label: 'zły kąt',
      sentence:
        angle.grade.level === 'bad'
          ? `${name} jest zły, bo idzie pod innym kątem niż wzór (ok. ${deg}°).`
          : `${name} lekko zmienia kąt (ok. ${deg}°).`,
    })
  }

  if (tremor.grade.level !== 'good') {
    issues.push({
      kind: 'tremor',
      level: tremor.grade.level,
      severity: tremor.grade.severity,
      label: 'drży',
      sentence: tremor.grade.level === 'bad' ? `${name} jest zły, bo za bardzo drży.` : `${name} lekko drży.`,
    })
  }

  if (pauses > 0) {
    const bad = pauses >= 2
    issues.push({
      kind: 'pause',
      level: bad ? 'bad' : 'warn',
      severity: bad ? 1.2 : 0.6,
      label: 'zatrzymanie',
      sentence: bad ? `${name} jest zły, bo ruch kilka razy się zatrzymuje.` : `${name} ma zatrzymanie ruchu.`,
    })
  }

  return issues.sort(
    (a, b) =>
      LEVEL_RANK[b.level] - LEVEL_RANK[a.level] ||
      ISSUE_PRIORITY.indexOf(a.kind) - ISSUE_PRIORITY.indexOf(b.kind) ||
      b.severity - a.severity,
  )
}

function goodSegmentsSentence(good: (typeof SEGMENTS)[number][], hasOtherProblems: boolean): string | null {
  if (good.length === 3) {
    return hasOtherProblems ? 'Prowadzenie linii jest świetne i płynne.' : 'Cała linia jest świetna i płynna.'
  }
  if (good.length === 2) {
    const [a, b] = good
    return `${a.short[0].toUpperCase()}${a.short.slice(1)} i ${b.short} linii są świetne i płynne.`
  }
  if (good.length === 1) return `${good[0].name} jest świetny i płynny.`
  return null
}


function offsetTolerance(reference: Stroke, refLength: number): { good: number; bad: number } {
  const good = Math.max(5, reference.brushSize / 2 + 2, 0.02 * refLength)
  return { good, bad: Math.max(14, good * 2.2, 0.045 * refLength) }
}

const TOO_SHORT: StrokeEvaluation = {
  tooShort: true,
  score: 0,
  level: 'bad',
  segments: [],
  lengthRatio: 0,
  startGapPx: 0,
  endGapPx: 0,
  speedPxPerSec: 0,
  reversed: false,
  worstPoint: null,
  summary: 'Za mało, żeby ocenić — dorysuj dalszą część linii.',
}

export function evaluateStroke(user: Stroke, reference: Stroke, rawPoints?: Point[]): StrokeEvaluation {
  const raw = rawPoints && rawPoints.length >= 2 ? rawPoints : user.points
  const refLength = pathLength(reference.points)
  const userLength = pathLength(user.points)

  if (user.points.length < 2 || reference.points.length < 2 || userLength < Math.max(15, 0.1 * refLength)) {
    return TOO_SHORT
  }

  const r0 = reference.points[0]
  const rN = reference.points[reference.points.length - 1]
  const u0 = user.points[0]
  const uN = user.points[user.points.length - 1]
  const closed = dist(r0, rN) < 0.15 * refLength
  const reversed = !closed && dist(u0, rN) + dist(uN, r0) < dist(u0, r0) + dist(uN, rN)
  const refPoints = reversed ? [...reference.points].reverse() : reference.points

  const U = resampleCount(user.points, SAMPLES)
  const R = resampleCount(refPoints, SAMPLES)

  const { good: offsetGood, bad: offsetBad } = offsetTolerance(reference, refLength)
  const gapGood = Math.max(10, 0.04 * refLength)
  const gapBad = Math.max(24, 0.1 * refLength)

  const nearest = U.map((p) => nearestOnPolyline(p, R))
  const refCumulative = [0]
  for (let i = 1; i < R.length; i++) refCumulative.push(refCumulative[i - 1] + dist(R[i - 1], R[i]))
  const tremor = tremorByThird(raw, U)
  const pauses = pausesByThird(raw, U)

  const third = SAMPLES / 3
  const segments: SegmentReport[] = []
  const segmentScores: { offset: number; angle: number; tremor: number }[] = []
  let worst: { severity: number; point: Vec } | null = null

  for (const [s, segment] of SEGMENTS.entries()) {
    const from = Math.round(s * third)
    const to = Math.round((s + 1) * third)
    let offsetSum = 0
    let angleSum = 0
    const vector = { x: 0, y: 0 }
    let localWorst = { d: -1, point: U[from] }

    let counted = 0
    for (let i = from; i < to; i++) {
      const n = nearest[i]
      if (n.beyondEnds && !closed) continue
      counted += 1
      offsetSum += n.distance
      vector.x += U[i].x - n.point.x
      vector.y += U[i].y - n.point.y
      if (n.distance > localWorst.d) localWorst = { d: n.distance, point: U[i] }

      const userTangent = { x: U[Math.min(i + 1, SAMPLES - 1)].x - U[Math.max(i - 1, 0)].x, y: U[Math.min(i + 1, SAMPLES - 1)].y - U[Math.max(i - 1, 0)].y }
      const a = R[n.segmentIndex]
      const b = R[n.segmentIndex + 1] ?? a
      const refTangent = { x: b.x - a.x, y: b.y - a.y }
      angleSum += Math.hypot(userTangent.x, userTangent.y) > 0 && Math.hypot(refTangent.x, refTangent.y) > 0 ? angleBetween(userTangent, refTangent) : 0
    }

    const count = Math.max(counted, 1)
    const offsetPx = offsetSum / count
    const angleDeg = angleSum / count
    const offsetGrade = grade(offsetPx, offsetGood, offsetBad)
    const angleGrade = grade(angleDeg, ANGLE_GOOD, ANGLE_BAD)
    const tremorGrade = grade(tremor[s], TREMOR_GOOD, TREMOR_BAD)

    const issues = segmentIssues(
      segment.name,
      { px: offsetPx, vector: { x: vector.x / count, y: vector.y / count }, grade: offsetGrade },
      { deg: angleDeg, grade: angleGrade },
      { px: tremor[s], grade: tremorGrade },
      pauses[s],
    )
    const level = issues.reduce<Level>((acc, issue) => worse(acc, issue.level), 'good')

    segments.push({ key: segment.key, level, offsetPx, angleDeg, tremorPx: tremor[s], pauses: pauses[s], issues })
    segmentScores.push({ offset: offsetGrade.score, angle: angleGrade.score, tremor: tremorGrade.score })

    const top = issues[0]
    if (top && (!worst || top.severity > worst.severity)) worst = { severity: top.severity, point: localWorst.point }
  }

  const along = nearest.map((n) => refCumulative[n.segmentIndex] + dist(R[n.segmentIndex], n.point))
  const lengthRatio = closed
    ? pathLength(resampleCount(user.points, 30)) / Math.max(refLength, 1)
    : (Math.max(...along) - Math.min(...along)) / Math.max(refCumulative[refCumulative.length - 1], 1)
  const lengthGrade = grade(Math.abs(1 - lengthRatio), LENGTH_GOOD, LENGTH_BAD)
  const startGapPx = dist(U[0], R[0])
  const endGapPx = dist(U[SAMPLES - 1], R[SAMPLES - 1])
  const gapGrade = closed ? grade(0, 1, 2) : grade(Math.max(startGapPx, endGapPx), gapGood, gapBad)

  const durationMs = raw[raw.length - 1].timestamp - raw[0].timestamp
  const rawLength = pathLength(raw)
  const speedPxPerSec = durationMs > 0 ? (rawLength / durationMs) * 1000 : 1000 / SLOWNESS_GOOD
  const speedGrade = grade(1000 / Math.max(speedPxPerSec, 1), SLOWNESS_GOOD, SLOWNESS_BAD)
  const pauseTotal = pauses.reduce((sum, n) => sum + n, 0)
  const pauseScore = pauseTotal === 0 ? 1 : pauseTotal === 1 ? 0.6 : 0.3

  const mean = (key: 'offset' | 'angle' | 'tremor') => {
    const values = segmentScores.map((s) => s[key])
    return 0.5 * (values.reduce((sum, v) => sum + v, 0) / values.length) + 0.5 * Math.min(...values)
  }
  const weighted: [number, number][] = [
    [mean('offset'), 3],
    [mean('angle'), 2],
    [mean('tremor'), 2],
    [lengthGrade.score, 1.5],
    [gapGrade.score, 1.5],
    [pauseScore, 1],
    [speedGrade.score, 0.5],
  ]
  const rawScore = Math.round(
    (100 * weighted.reduce((sum, [s, w]) => sum + s * w, 0)) / weighted.reduce((sum, [, w]) => sum + w, 0),
  )

  const globalIssues: { severity: number; sentence: string }[] = []
  if (lengthGrade.level !== 'good') {
    const pct = Math.round(Math.abs(1 - lengthRatio) * 100)
    globalIssues.push({
      severity: lengthGrade.severity,
      sentence: lengthRatio < 1 ? `Linia jest za krótka o ${pct}%.` : `Linia jest za długa o ${pct}%.`,
    })
  }
  if (gapGrade.level !== 'good') {
    globalIssues.push({
      severity: gapGrade.severity,
      sentence:
        startGapPx >= endGapPx
          ? `Start jest ${Math.round(startGapPx)} px obok początku wzoru.`
          : `Koniec mija punkt końcowy o ${Math.round(endGapPx)} px.`,
    })
  }
  if (speedGrade.level === 'bad' && pauseTotal === 0) {
    globalIssues.push({ severity: speedGrade.severity, sentence: 'Ruch jest za wolny — prowadź linię jednym, szybszym pociągnięciem.' })
  }

  const problemSentences = segments
    .filter((segment) => segment.issues.length > 0)
    .sort((a, b) => LEVEL_RANK[b.level] - LEVEL_RANK[a.level] || b.issues[0].severity - a.issues[0].severity)
    .map((segment) => segment.issues[0].sentence)
  const goodSentence = goodSegmentsSentence(
    SEGMENTS.filter((_, i) => segments[i].level === 'good'),
    globalIssues.length > 0,
  )
  const sentences = [...problemSentences, ...(goodSentence ? [goodSentence] : []), ...globalIssues.slice(0, 1).map((g) => g.sentence)]

  const overall = [lengthGrade.level, gapGrade.level, ...segments.map((s) => s.level)].reduce<Level>(worse, 'good')
  const score = Math.min(rawScore, overall === 'bad' ? 75 : overall === 'warn' ? 90 : 100)
  const level: Level = overall === 'good' && score >= 80 ? 'good' : score >= 55 ? 'warn' : 'bad'

  return {
    tooShort: false,
    score,
    level,
    segments,
    lengthRatio,
    startGapPx,
    endGapPx,
    speedPxPerSec,
    reversed,
    worstPoint: overall === 'good' || !worst ? null : worst.point,
    summary: sentences.join(' '),
  }
}

/** Pozycja punktu wzdłuż linii, w pikselach od jej początku. */
function alongLine(p: Vec, line: Vec[], cumulative: number[]): number {
  const nearest = nearestOnPolyline(p, line)
  return cumulative[nearest.segmentIndex] + dist(line[nearest.segmentIndex], nearest.point)
}

function cumulativeLengths(line: Vec[]): number[] {
  const out = [0]
  for (let i = 1; i < line.length; i++) out.push(out[i - 1] + dist(line[i - 1], line[i]))
  return out
}

/**
 * Kilka kresek jednego kroku jako jedna linia do oceny: ułożone w kolejności wzdłuż wzoru,
 * każda w kierunku wzoru, a czas sklejony bez przerw — oderwanie pędzla to nie zatrzymanie ręki.
 */
export function combineStepStrokes(parts: { stroke: Stroke; raw?: Point[] }[], reference: Stroke): { stroke: Stroke; raw: Point[] } {
  const usable = parts.filter((part) => part.stroke.points.length >= 2)
  if (usable.length === 0) return { stroke: parts[0]?.stroke ?? { ...reference, points: [] }, raw: [] }
  if (usable.length === 1) return { stroke: usable[0].stroke, raw: usable[0].raw ?? usable[0].stroke.points }

  const cumulative = cumulativeLengths(reference.points)
  const oriented = usable.map(({ stroke, raw }) => {
    const points = stroke.points
    const a = alongLine(points[0], reference.points, cumulative)
    const b = alongLine(points[points.length - 1], reference.points, cumulative)
    const flip = <T extends Point>(list: T[]): T[] => {
      const t0 = list[0].timestamp
      const tN = list[list.length - 1].timestamp
      return [...list].reverse().map((p) => ({ ...p, timestamp: t0 + (tN - p.timestamp) }))
    }
    const rawPoints = raw && raw.length >= 2 ? raw : points
    return a <= b
      ? { key: a, points, raw: rawPoints }
      : { key: b, points: flip(points), raw: flip(rawPoints) }
  })
  oriented.sort((x, y) => x.key - y.key)

  const points: Point[] = []
  const raw: Point[] = []
  let clock = 0
  for (const part of oriented) {
    const start = part.raw[0].timestamp
    const offset = (raw.length ? clock + 16 : 0) - start
    for (const p of part.raw) raw.push({ ...p, timestamp: p.timestamp + offset })
    const pointOffset = (points.length ? clock + 16 : 0) - part.points[0].timestamp
    for (const p of part.points) points.push({ ...p, timestamp: p.timestamp + pointOffset })
    clock = raw[raw.length - 1].timestamp
  }
  return { stroke: { ...usable[0].stroke, points }, raw }
}

export type LiveProgress = {
  accuracy: number
  coverage: number
  tolerancePx: number
}

export function liveProgress(drawn: Stroke | Stroke[], reference: Stroke): LiveProgress | null {
  const lines = (Array.isArray(drawn) ? drawn : [drawn]).filter((stroke) => stroke.points.length >= 2)
  if (lines.length === 0 || reference.points.length < 2) return null

  const refLength = pathLength(reference.points)
  const { good, bad } = offsetTolerance(reference, refLength)

  const cumulative = [0]
  for (let i = 1; i < reference.points.length; i++) {
    cumulative.push(cumulative[i - 1] + dist(reference.points[i - 1], reference.points[i]))
  }
  const total = cumulative[cumulative.length - 1]

  const covered = new Array<boolean>(COVERAGE_BINS).fill(false)
  let sum = 0
  let count = 0

  for (const line of lines) {
    const step = Math.max(1, Math.floor(line.points.length / 60))
    for (let i = 0; i < line.points.length; i += step) {
      const nearest = nearestOnPolyline(line.points[i], reference.points)
      sum += nearest.distance
      count += 1

      if (nearest.distance <= bad && total > 0) {
        const along = cumulative[nearest.segmentIndex] + dist(reference.points[nearest.segmentIndex], nearest.point)
        covered[Math.min(COVERAGE_BINS - 1, Math.floor((along / total) * COVERAGE_BINS))] = true
      }
    }
  }

  return {
    accuracy: Math.round(grade(sum / count, good, bad).score * 100),
    coverage: Math.round((covered.filter(Boolean).length / COVERAGE_BINS) * 100),
    tolerancePx: bad,
  }
}
