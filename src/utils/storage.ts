import type { Point, ReferenceDrawing, Stroke } from '../types/drawing'
import { cloneStrokes } from './strokes'

const REFERENCE_STORAGE_KEY = 'drawing-training-references'

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

function isStroke(value: unknown): value is Stroke {
  return Array.isArray(value) && value.every((point) => isPoint(point))
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
    typeof reference.createdAt === 'number' &&
    Number.isFinite(reference.createdAt) &&
    Array.isArray(reference.strokes) &&
    reference.strokes.every((stroke) => isStroke(stroke))
  )
}

function cloneReference(reference: ReferenceDrawing): ReferenceDrawing {
  return {
    id: reference.id,
    name: reference.name,
    strokes: cloneStrokes(reference.strokes),
    createdAt: reference.createdAt,
  }
}

export function isStrokeCollectionEmpty(strokes: Stroke[]): boolean {
  return strokes.length === 0 || strokes.every((stroke) => stroke.length === 0)
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

  const validReferences = parsed.filter((item): item is ReferenceDrawing =>
    validateReference(item),
  )

  if (validReferences.length !== parsed.length) {
    return {
      data: validReferences.map(cloneReference),
      error: 'Some saved references were invalid and were ignored.',
    }
  }

  return { data: validReferences.map(cloneReference), error: null }
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