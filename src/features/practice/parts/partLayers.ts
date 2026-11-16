import type { Layer, Stroke } from '../../../types/drawing'

export type CoursePart = { id: string; name: string }
export type PartView = { visible: boolean; opacity: number }

const OTHER: CoursePart = { id: 'other', name: 'Pozostałe kreski' }

/** Części kursu w kolejności pierwszego wystąpienia. Kroki bez części (stare kursy) idą do jednej. */
export function courseParts(steps: { part?: CoursePart }[]): CoursePart[] {
  const seen = new Map<string, CoursePart>()
  for (const step of steps) {
    const part = step.part ?? { id: 'drawing', name: 'Rysunek' }
    if (!seen.has(part.id)) seen.set(part.id, part)
  }
  return [...seen.values()]
}

/** Warstwa na każdą część; kreska trafia na warstwę części kroku, w którym ją narysowano. */
export function partLayers(
  strokes: Stroke[],
  steps: { part?: CoursePart }[],
  views: Record<string, PartView>,
): Layer[] {
  const parts = courseParts(steps)
  const partOf = (stroke: Stroke) =>
    stroke.stepIndex === undefined ? OTHER : (steps[stroke.stepIndex]?.part ?? parts[0] ?? OTHER)

  const byPart = new Map<string, Stroke[]>()
  for (const stroke of strokes) {
    const id = partOf(stroke).id
    byPart.set(id, [...(byPart.get(id) ?? []), stroke])
  }

  return [...parts, OTHER]
    .filter((part) => part !== OTHER || byPart.has(OTHER.id))
    .map((part) => ({
      id: part.id,
      name: part.name,
      visible: views[part.id]?.visible ?? true,
      opacity: views[part.id]?.opacity ?? 1,
      strokes: byPart.get(part.id) ?? [],
      erases: [],
    }))
}
