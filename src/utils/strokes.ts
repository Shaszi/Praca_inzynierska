import type { Stroke } from '../types/drawing'

// Spread, nie wypisywanie pól: inaczej każde nowe pole Stroke/Point ginie tu po cichu,
// bez błędu kompilacji, i objawia się dopiero po cofnięciu albo zapisie.
export function cloneStrokes(strokes: Stroke[]): Stroke[] {
  return strokes.map((stroke) => ({
    ...stroke,
    points: stroke.points.map((point) => ({ ...point })),
  }))
}