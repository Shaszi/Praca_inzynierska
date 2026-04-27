import type { Point, ReferenceDrawing, Stroke } from '../../../types/drawing'

const DEFAULT_BRUSH_SIZE = 5

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function isPoint(value: unknown): value is Point {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const point = value as Partial<Point>
  return isFiniteNumber(point.x) && isFiniteNumber(point.y) && isFiniteNumber(point.timestamp)
}

export function isModernStroke(value: unknown): value is Stroke {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const stroke = value as Partial<Stroke>
  return (
    isFiniteNumber(stroke.brushSize) &&
    stroke.brushSize > 0 &&
    Array.isArray(stroke.points) &&
    stroke.points.every((point) => isPoint(point))
  )
}

export function normalizeStroke(value: unknown): Stroke | null {
  if (isModernStroke(value)) {
    return {
      brushSize: value.brushSize,
      points: value.points.map((point) => ({ ...point })),
    }
  }

  // Legacy migration: old format stored a stroke as Point[].
  if (Array.isArray(value) && value.every((point) => isPoint(point))) {
    return {
      brushSize: DEFAULT_BRUSH_SIZE,
      points: value.map((point) => ({ ...point })),
    }
  }

  return null
}

export function normalizeReference(value: unknown): ReferenceDrawing | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  const reference = value as Partial<ReferenceDrawing>
  if (
    typeof reference.id !== 'string' ||
    reference.id.trim().length === 0 ||
    typeof reference.name !== 'string' ||
    reference.name.trim().length === 0 ||
    !isFiniteNumber(reference.createdAt) ||
    !Array.isArray(reference.strokes)
  ) {
    return null
  }

  const normalizedStrokes: Stroke[] = []
  for (const strokeCandidate of reference.strokes) {
    const normalizedStroke = normalizeStroke(strokeCandidate)
    if (!normalizedStroke) {
      return null
    }
    normalizedStrokes.push(normalizedStroke)
  }

  return {
    id: reference.id,
    name: reference.name,
    createdAt: reference.createdAt,
    strokes: normalizedStrokes,
  }
}

export function validateReference(value: unknown): value is ReferenceDrawing {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const reference = value as Partial<ReferenceDrawing>
  return (
    typeof reference.id === 'string' &&
    reference.id.trim().length > 0 &&
    typeof reference.name === 'string' &&
    reference.name.trim().length > 0 &&
    isFiniteNumber(reference.createdAt) &&
    Array.isArray(reference.strokes) &&
    reference.strokes.every((stroke) => isModernStroke(stroke))
  )
}

export function isStrokeCollectionEmpty(strokes: Stroke[]): boolean {
  return strokes.length === 0 || strokes.every((stroke) => stroke.points.length === 0)
}
