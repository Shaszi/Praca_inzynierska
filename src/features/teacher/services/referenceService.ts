import type { ReferenceDrawing, Stroke } from '../../../types/drawing'
import { cloneStrokes } from '../../../utils/strokes'
import { createReferenceId, createUniqueReferenceName } from '../utils/referenceUtils'
import { validateReference } from '../utils/referenceValidation'
import { referenceStorageService } from './referenceStorageService'
import type { StorageResult } from './storageTypes'

function cloneReference(reference: ReferenceDrawing): ReferenceDrawing {
  return {
    id: reference.id,
    name: reference.name,
    createdAt: reference.createdAt,
    strokes: cloneStrokes(reference.strokes),
  }
}

export const referenceService = {
  // Service layer keeps reference business rules independent from UI components.
  loadReferences(): Promise<StorageResult<ReferenceDrawing[]>> {
    return referenceStorageService.loadReferences()
  },

  createReference(
    nameInput: string,
    strokes: Stroke[],
    existingReferences: ReferenceDrawing[],
  ): Promise<StorageResult<ReferenceDrawing | null>> {
    return referenceStorageService.insertReference(
      createUniqueReferenceName(nameInput, existingReferences),
      cloneStrokes(strokes),
    )
  },

  deleteReference(id: string): Promise<StorageResult<null>> {
    return referenceStorageService.deleteReference(id)
  },

  parseImportedReference(jsonText: string): StorageResult<ReferenceDrawing> {
    let parsed: unknown
    try {
      parsed = JSON.parse(jsonText)
    } catch {
      return { data: null as never, error: 'Invalid JSON file.' }
    }

    if (!validateReference(parsed)) {
      return {
        data: null as never,
        error: 'Invalid reference structure. Expected id, name, strokes, and createdAt.',
      }
    }

    return { data: cloneReference(parsed), error: null }
  },

  prepareImportedReference(
    importedReference: ReferenceDrawing,
    existingReferences: ReferenceDrawing[],
  ): ReferenceDrawing {
    return {
      ...cloneReference(importedReference),
      id: createReferenceId(),
      name: createUniqueReferenceName(importedReference.name, existingReferences),
    }
  },

  cloneReferenceStrokes(reference: ReferenceDrawing): Stroke[] {
    return cloneStrokes(reference.strokes)
  },
}