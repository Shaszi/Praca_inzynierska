import type { ReferenceDrawing } from '../types/drawing'
import { referenceStorageService } from '../features/teacher/services/referenceStorageService'

export type { StorageResult } from '../features/teacher/services/storageTypes'
export { validateReference, isStrokeCollectionEmpty } from '../features/teacher/utils/referenceValidation'

export function loadReferences() {
  return referenceStorageService.loadReferences()
}

export function saveReferences(references: ReferenceDrawing[]) {
  return referenceStorageService.saveReferences(references)
}