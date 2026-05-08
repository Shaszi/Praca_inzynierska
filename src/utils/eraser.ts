import type { Point, Stroke } from "../types/drawing";

type Segment = { start: Point; end: Point };

const EPSILON = 0.0001;
const MIN_FRAGMENT_LENGTH = 2;

function getEffectiveEraseRadius(
  eraserRadius: number,
  brushSize: number,
): number {
  return eraserRadius + brushSize / 2;
}

function squaredDistance(point: Point, x: number, y: number): number {
  const dx = point.x - x;
  const dy = point.y - y;
  return dx * dx + dy * dy;
}

function interpolatePoint(a: Point, b: Point, t: number): Point {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    timestamp: Math.round(a.timestamp + (b.timestamp - a.timestamp) * t),
  };
}

function segmentCircleIntersections(
  a: Point,
  b: Point,
  centerX: number,
  centerY: number,
  radius: number,
): number[] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const fx = a.x - centerX;
  const fy = a.y - centerY;

  const quadraticA = dx * dx + dy * dy;
  if (quadraticA <= EPSILON) {
    return [];
  }

  const quadraticB = 2 * (fx * dx + fy * dy);
  const quadraticC = fx * fx + fy * fy - radius * radius;
  const discriminant = quadraticB * quadraticB - 4 * quadraticA * quadraticC;

  if (discriminant < 0) {
    return [];
  }

  if (Math.abs(discriminant) <= EPSILON) {
    const t = -quadraticB / (2 * quadraticA);
    return t > 0 && t < 1 ? [t] : [];
  }

  const sqrtDiscriminant = Math.sqrt(discriminant);
  const t1 = (-quadraticB - sqrtDiscriminant) / (2 * quadraticA);
  const t2 = (-quadraticB + sqrtDiscriminant) / (2 * quadraticA);

  const intersections: number[] = [];
  if (t1 > 0 && t1 < 1) intersections.push(t1);
  if (t2 > 0 && t2 < 1) intersections.push(t2);
  intersections.sort((left, right) => left - right);
  return intersections;
}

function clipOutsideCircle(
  a: Point,
  b: Point,
  centerX: number,
  centerY: number,
  radius: number,
): Segment[] {
  const radiusSquared = radius * radius;
  const aInside = squaredDistance(a, centerX, centerY) <= radiusSquared;
  const bInside = squaredDistance(b, centerX, centerY) <= radiusSquared;
  const hits = segmentCircleIntersections(a, b, centerX, centerY, radius);

  if (aInside && bInside) {
    return [];
  }

  if (!aInside && !bInside) {
    if (hits.length < 2) {
      return [{ start: a, end: b }];
    }

    return [
      { start: a, end: interpolatePoint(a, b, hits[0]) },
      { start: interpolatePoint(a, b, hits[1]), end: b },
    ];
  }

  if (hits.length === 0) {
    return !aInside && !bInside ? [{ start: a, end: b }] : [];
  }

  const crossingPoint = interpolatePoint(a, b, hits[0]);
  if (aInside && !bInside) {
    return [{ start: crossingPoint, end: b }];
  }

  if (!aInside && bInside) {
    return [{ start: a, end: crossingPoint }];
  }

  return [];
}

function pushUniquePoint(points: Point[], point: Point): void {
  const lastPoint = points[points.length - 1];
  if (!lastPoint) {
    points.push(point);
    return;
  }

  if (
    Math.abs(lastPoint.x - point.x) <= EPSILON &&
    Math.abs(lastPoint.y - point.y) <= EPSILON
  ) {
    return;
  }

  points.push(point);
}

function fragmentLength(points: Point[]): number {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const dx = points[index].x - points[index - 1].x;
    const dy = points[index].y - points[index - 1].y;
    total += Math.sqrt(dx * dx + dy * dy);
  }
  return total;
}

function strokeFromFragment(brushSize: number, points: Point[]): Stroke | null {
  if (points.length < 2) {
    return null;
  }

  if (fragmentLength(points) < MIN_FRAGMENT_LENGTH) {
    return null;
  }

  return {
    brushSize,
    points,
  };
}

function shouldKeepSinglePointStroke(
  point: Point,
  x: number,
  y: number,
  eraserRadius: number,
  brushSize: number,
): boolean {
  const effectiveRadius = getEffectiveEraseRadius(eraserRadius, brushSize);
  return squaredDistance(point, x, y) > effectiveRadius * effectiveRadius;
}

export function eraseAtPoint(
  strokes: Stroke[],
  x: number,
  y: number,
  radius: number,
): Stroke[] {
  if (radius <= 0 || strokes.length === 0) {
    return strokes;
  }

  const nextStrokes: Stroke[] = [];

  for (const stroke of strokes) {
    const sourcePoints = stroke.points;
    const effectiveRadius = getEffectiveEraseRadius(radius, stroke.brushSize);

    if (sourcePoints.length === 1) {
      if (
        shouldKeepSinglePointStroke(
          sourcePoints[0],
          x,
          y,
          radius,
          stroke.brushSize,
        )
      ) {
        nextStrokes.push({
          brushSize: stroke.brushSize,
          points: [{ ...sourcePoints[0] }],
        });
      }
      continue;
    }

    if (sourcePoints.length < 2) {
      continue;
    }

    let currentFragment: Point[] = [];

    for (let index = 0; index < sourcePoints.length - 1; index += 1) {
      const a = sourcePoints[index];
      const b = sourcePoints[index + 1];
      const keptSegments = clipOutsideCircle(a, b, x, y, effectiveRadius);

      if (keptSegments.length === 0) {
        const completedStroke = strokeFromFragment(
          stroke.brushSize,
          currentFragment,
        );
        if (completedStroke) {
          nextStrokes.push(completedStroke);
        }
        currentFragment = [];
        continue;
      }

      for (
        let segmentIndex = 0;
        segmentIndex < keptSegments.length;
        segmentIndex += 1
      ) {
        const segment = keptSegments[segmentIndex];

        if (currentFragment.length === 0) {
          currentFragment.push({ ...segment.start });
        } else {
          const lastPoint = currentFragment[currentFragment.length - 1];
          const contiguous =
            Math.abs(lastPoint.x - segment.start.x) <= EPSILON &&
            Math.abs(lastPoint.y - segment.start.y) <= EPSILON;

          if (!contiguous) {
            const completedStroke = strokeFromFragment(
              stroke.brushSize,
              currentFragment,
            );
            if (completedStroke) {
              nextStrokes.push(completedStroke);
            }
            currentFragment = [{ ...segment.start }];
          }
        }

        pushUniquePoint(currentFragment, { ...segment.end });
      }
    }

    const completedStroke = strokeFromFragment(
      stroke.brushSize,
      currentFragment,
    );
    if (completedStroke) {
      nextStrokes.push(completedStroke);
    }
  }

  return nextStrokes;
}
