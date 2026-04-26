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

  const candidate = value as Partial<Point>
  return (
    typeof candidate.x === 'number' &&
    Number.isFinite(candidate.x) &&
    typeof candidate.y === 'number' &&
    Number.isFinite(candidate.y) &&
    typeof candidate.timestamp === 'number' &&
    Number.isFinite(candidate.timestamp)
  )
}

function isStroke(value: unknown): value is Stroke {
  return Array.isArray(value) && value.every((point) => isPoint(point))
}

export function isReferenceDrawing(value: unknown): value is ReferenceDrawing {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const candidate = value as Partial<ReferenceDrawing>
  return (
    typeof candidate.id === 'string' &&
    candidate.id.trim().length > 0 &&
    typeof candidate.name === 'string' &&
    candidate.name.trim().length > 0 &&
    typeof candidate.createdAt === 'number' &&
    Number.isFinite(candidate.createdAt) &&
    Array.isArray(candidate.strokes) &&
    candidate.strokes.every((stroke) => isStroke(stroke))
  )
}

function cloneReference(reference: ReferenceDrawing): ReferenceDrawing {
  return {
    id: reference.id,
    name: reference.name,
    createdAt: reference.createdAt,
    strokes: cloneStrokes(reference.strokes),
  }
}

export function isStrokeCollectionEmpty(strokes: Stroke[]): boolean {
  return strokes.length === 0 || strokes.every((stroke) => stroke.length === 0)
}

export function loadReferencesFromStorage(): StorageResult<ReferenceDrawing[]> {
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
    isReferenceDrawing(item),
  )

  if (validReferences.length !== parsed.length) {
    return {
      data: validReferences.map(cloneReference),
      error: 'Some saved references were invalid and have been ignored.',
    }
  }

  return { data: validReferences.map(cloneReference), error: null }
}

export function persistReferences(references: ReferenceDrawing[]): StorageResult<null> {
  if (typeof window === 'undefined') {
    return { data: null, error: null }
  }

  try {
    window.localStorage.setItem(REFERENCE_STORAGE_KEY, JSON.stringify(references))
    return { data: null, error: null }
  } catch {
    return { data: null, error: 'Unable to save references to local storage.' }
  }
}

export function parseImportedReference(jsonText: string): StorageResult<ReferenceDrawing> {
  let parsed: unknown

  try {
    parsed = JSON.parse(jsonText)
  } catch {
    return { data: null as never, error: 'Invalid JSON file.' }
  }

  if (!isReferenceDrawing(parsed)) {
    return {
      data: null as never,
      error:
        'Invalid reference structure. Expected id, name, strokes, and createdAt fields.',
    }
  }

  return { data: cloneReference(parsed), error: null }
}

export function serializeReference(reference: ReferenceDrawing): string {
  // Export a plain JSON payload so files remain tool-friendly and portable.
  return JSON.stringify(cloneReference(reference), null, 2)
}

// Backward-compatible helper for existing callers.
export function loadReferences(): ReferenceDrawing[] {
  return loadReferencesFromStorage().data
}