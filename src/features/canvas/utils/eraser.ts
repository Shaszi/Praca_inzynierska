import type { Point, Stroke } from "../../../types/drawing";
import { eraseAtPoint } from "../../../utils/eraser";

// Pure eraser utility: remove points by radius and split strokes when gaps appear.
export function erasePointsFromStrokes(
  strokes: Stroke[],
  cursorPoint: Point,
  radius: number,
): Stroke[] {
  return eraseAtPoint(strokes, cursorPoint.x, cursorPoint.y, radius);
}
