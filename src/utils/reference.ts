import type { ReferenceDrawing } from '../types/drawing'

export function createReferenceId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `ref-${Date.now()}`
}

export function createUniqueReferenceName(
  proposedName: string,
  existingReferences: ReferenceDrawing[],
): string {
  const trimmed = proposedName.trim()
  const baseName = trimmed.length > 0 ? trimmed : `Reference ${existingReferences.length + 1}`

  if (!existingReferences.some((reference) => reference.name === baseName)) {
    return baseName
  }

  let counter = 2
  let candidate = `${baseName} (${counter})`

  while (existingReferences.some((reference) => reference.name === candidate)) {
    counter += 1
    candidate = `${baseName} (${counter})`
  }

  return candidate
}