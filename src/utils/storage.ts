import type { ReferenceDrawing } from '../types/drawing'

const REFERENCE_STORAGE_KEY = 'drawing-training-references'

export function loadReferences(): ReferenceDrawing[] {
  if (typeof window === 'undefined') {
    return []
  }

  const raw = window.localStorage.getItem(REFERENCE_STORAGE_KEY)
  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter(
      (item): item is ReferenceDrawing =>
        typeof item === 'object' &&
        item !== null &&
        typeof item.id === 'string' &&
        typeof item.name === 'string' &&
        typeof item.createdAt === 'number' &&
        Array.isArray(item.strokes),
    )
  } catch {
    return []
  }
}

export function saveReferences(references: ReferenceDrawing[]): void {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(REFERENCE_STORAGE_KEY, JSON.stringify(references))
}