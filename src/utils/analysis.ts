import type { Point, Stroke } from '../types/drawing'

const EPSILON = 1e-6
const COMPARISON_POINTS = 32
const MAX_NORMALIZED_DISTANCE = Math.SQRT2

export function distanceBetweenPoints(a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  return Math.hypot(dx, dy)
}

function normalizePoints(points: Point[]): Point[] {
  if (points.length === 0) {
    return []
  }

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  for (const point of points) {
    minX = Math.min(minX, point.x)
    maxX = Math.max(maxX, point.x)
    minY = Math.min(minY, point.y)
    maxY = Math.max(maxY, point.y)
  }

  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2
  const scale = Math.max(maxX - minX, maxY - minY, EPSILON)

  return points.map((point) => ({
    x: (point.x - centerX) / scale,
    y: (point.y - centerY) / scale,
    timestamp: point.timestamp,
  }))
}

function pointsLength(points: Point[]): number {
  if (points.length < 2) {
    return 0
  }

  let length = 0
  for (let index = 1; index < points.length; index += 1) {
    length += distanceBetweenPoints(points[index - 1], points[index])
  }

  return length
}

function resamplePoints(points: Point[], targetPoints = COMPARISON_POINTS): Point[] {
  if (points.length === 0 || targetPoints <= 0) {
    return []
  }

  if (points.length === 1) {
    return Array.from({ length: targetPoints }, () => ({ ...points[0] }))
  }

  const totalLength = pointsLength(points)
  if (totalLength <= EPSILON) {
    return Array.from({ length: targetPoints }, () => ({ ...points[0] }))
  }

  const spacing = totalLength / (targetPoints - 1)
  const sampled: Point[] = [{ ...points[0] }]

  let previous = { ...points[0] }
  let accumulated = 0

  for (let index = 1; index < points.length; index += 1) {
    const current = points[index]
    let segmentLength = distanceBetweenPoints(previous, current)

    while (accumulated + segmentLength >= spacing) {
      const remainder = spacing - accumulated
      const ratio = segmentLength > EPSILON ? remainder / segmentLength : 0

      const interpolated: Point = {
        x: previous.x + (current.x - previous.x) * ratio,
        y: previous.y + (current.y - previous.y) * ratio,
        timestamp:
          previous.timestamp + (current.timestamp - previous.timestamp) * ratio,
      }

      sampled.push(interpolated)
      previous = interpolated
      segmentLength = distanceBetweenPoints(previous, current)
      accumulated = 0

      if (sampled.length === targetPoints) {
        return sampled
      }
    }

    accumulated += segmentLength
    previous = current
  }

  const tailPoint = { ...points[points.length - 1] }
  while (sampled.length < targetPoints) {
    sampled.push(tailPoint)
  }

  return sampled
}

function normalizedSample(stroke: Stroke): Point[] {
  return resamplePoints(normalizePoints(stroke.points))
}

export function compareStrokes(strokeA: Stroke, strokeB: Stroke): number {
  if (strokeA.points.length === 0 || strokeB.points.length === 0) {
    return 0
  }

  // This point-to-point strategy is intentionally simple, so DTW can replace
  // it later without changing the external compareStrokes API.
  const normalizedA = normalizedSample(strokeA)
  const normalizedB = normalizedSample(strokeB)

  const comparisonLength = Math.min(normalizedA.length, normalizedB.length)
  if (comparisonLength === 0) {
    return 0
  }

  let totalDistance = 0
  for (let index = 0; index < comparisonLength; index += 1) {
    totalDistance += distanceBetweenPoints(normalizedA[index], normalizedB[index])
  }

  const averageDistance = totalDistance / comparisonLength
  const clampedDistance = Math.min(averageDistance / MAX_NORMALIZED_DISTANCE, 1)

  return 1 - clampedDistance
}