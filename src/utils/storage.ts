import type { Point, ReferenceDrawing, Stroke } from '../types/drawing'
import { cloneStrokes } from './strokes'

const REFERENCE_STORAGE_KEY = 'drawing-training-references'
const DEFAULT_BRUSH_SIZE = 5

export type StorageResult<T> = {
  data: T
  error: string | null
}

function isPoint(value: unknown): value is Point {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const point = value as Partial<Point>
  return (
    typeof point.x === 'number' &&
    Number.isFinite(point.x) &&
    typeof point.y === 'number' &&
    Number.isFinite(point.y) &&
    typeof point.timestamp === 'number' &&
    Number.isFinite(point.timestamp)
  )
}

function isModernStroke(value: unknown): value is Stroke {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const stroke = value as Partial<Stroke>
  return (
    typeof stroke.brushSize === 'number' &&
    Number.isFinite(stroke.brushSize) &&
    stroke.brushSize > 0 &&
    Array.isArray(stroke.points) &&
    stroke.points.every((point) => isPoint(point))
  )
}

function isModernReference(value: unknown): value is ReferenceDrawing {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const reference = value as Partial<ReferenceDrawing>

  return (
    typeof reference.id === 'string' &&
    reference.id.trim().length > 0 &&
    typeof reference.name === 'string' &&
    reference.name.trim().length > 0 &&
    typeof reference.createdAt === 'number' &&
    Number.isFinite(reference.createdAt) &&
    Array.isArray(reference.strokes) &&
    reference.strokes.every((stroke) => isModernStroke(stroke))
  )
}

function normalizeStroke(value: unknown): Stroke | null {
  if (isModernStroke(value)) {
    return {
      brushSize: value.brushSize,
      points: value.points.map((point) => ({ ...point })),
    }
  }

  // Backward compatibility for legacy storage format: Stroke was Point[].
  if (Array.isArray(value) && value.every((point) => isPoint(point))) {
    return {
      brushSize: DEFAULT_BRUSH_SIZE,
      points: value.map((point) => ({ ...point })),
    }
  }

  return null
}

function normalizeReference(value: unknown): ReferenceDrawing | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  const reference = value as Partial<ReferenceDrawing>

  if (
    typeof reference.id !== 'string' ||
    reference.id.trim().length === 0 ||
    typeof reference.name !== 'string' ||
    reference.name.trim().length === 0 ||
    typeof reference.createdAt !== 'number' ||
    !Number.isFinite(reference.createdAt) ||
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

function cloneReferences(references: ReferenceDrawing[]): ReferenceDrawing[] {
  return references.map((reference) => ({
    ...reference,
    strokes: cloneStrokes(reference.strokes),
  }))
}

export function validateReference(value: unknown): value is ReferenceDrawing {
  return isModernReference(value)
}

export function isStrokeCollectionEmpty(strokes: Stroke[]): boolean {
  return strokes.length === 0 || strokes.every((stroke) => stroke.points.length === 0)
}

export function loadReferences(): StorageResult<ReferenceDrawing[]> {
  if (typeof window === 'undefined') {
    return { data: [], error: null }
  }

  let rawValue: string | null
  try {
    rawValue = window.localStorage.getItem(REFERENCE_STORAGE_KEY)
  } catch {
    return { data: [], error: 'Unable to read references from local storage.' }
  }

  if (!rawValue) {
    return { data: [], error: null }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(rawValue)
  } catch {
    return { data: [], error: 'Saved references are corrupted and could not be parsed.' }
  }

  if (!Array.isArray(parsed)) {
    return { data: [], error: 'Saved references have an invalid format.' }
  }

  const normalized: ReferenceDrawing[] = []

  for (const candidate of parsed) {
    const normalizedReference = normalizeReference(candidate)
    if (normalizedReference) {
      normalized.push(normalizedReference)
    }
  }

  if (normalized.length !== parsed.length) {
    return {
      data: cloneReferences(normalized),
      error: 'Some saved references were invalid and were ignored.',
    }
  }

  return { data: cloneReferences(normalized), error: null }
}

export function saveReferences(references: ReferenceDrawing[]): StorageResult<null> {
  if (typeof window === 'undefined') {
    return { data: null, error: null }
  }

  const areAllValid = references.every((reference) => validateReference(reference))
  if (!areAllValid) {
    return { data: null, error: 'Cannot save invalid reference data.' }
  }

  try {
    window.localStorage.setItem(REFERENCE_STORAGE_KEY, JSON.stringify(references))
    return { data: null, error: null }
  } catch {
    return { data: null, error: 'Unable to save references to local storage.' }
  }
}