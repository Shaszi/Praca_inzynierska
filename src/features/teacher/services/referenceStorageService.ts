import type { ReferenceDrawing } from '../../../types/drawing'
import { cloneStrokes } from '../../../utils/strokes'
import { normalizeReference, validateReference } from '../utils/referenceValidation'
import type { StorageResult } from './storageTypes'

const STORAGE_KEY = 'drawing-training-references'

function cloneReferences(references: ReferenceDrawing[]): ReferenceDrawing[] {
  return references.map((reference) => ({
    ...reference,
    strokes: cloneStrokes(reference.strokes),
  }))
}

export const referenceStorageService = {
  loadReferences(): StorageResult<ReferenceDrawing[]> {
    if (typeof window === 'undefined') {
      return { data: [], error: null }
    }

    let rawValue: string | null
    try {
      rawValue = window.localStorage.getItem(STORAGE_KEY)
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

    const normalizedReferences = parsed
      .map((candidate) => normalizeReference(candidate))
      .filter((reference): reference is ReferenceDrawing => reference !== null)

    const error =
      normalizedReferences.length === parsed.length
        ? null
        : 'Some saved references were invalid and were ignored.'

    return { data: cloneReferences(normalizedReferences), error }
  },

  saveReferences(references: ReferenceDrawing[]): StorageResult<null> {
    if (typeof window === 'undefined') {
      return { data: null, error: null }
    }

    if (!references.every((reference) => validateReference(reference))) {
      return { data: null, error: 'Cannot save invalid reference data.' }
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(references))
      return { data: null, error: null }
    } catch {
      return { data: null, error: 'Unable to save references to local storage.' }
    }
  },
}
