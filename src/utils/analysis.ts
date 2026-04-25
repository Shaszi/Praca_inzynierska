import type { Point, Stroke } from '../types/drawing'

const EPSILON = 1e-6
const COMPARISON_POINTS = 32
const MAX_NORMALIZED_DISTANCE = Math.SQRT2

export function distanceBetweenPoints(a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  return Math.hypot(dx, dy)
}

export function normalizeStroke(stroke: Stroke): Stroke {
  if (stroke.length === 0) {
    return []
  }

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  for (const point of stroke) {
    minX = Math.min(minX, point.x)
    maxX = Math.max(maxX, point.x)
    minY = Math.min(minY, point.y)
    maxY = Math.max(maxY, point.y)
  }

  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2
  const scale = Math.max(maxX - minX, maxY - minY, EPSILON)

  return stroke.map((point) => ({
    x: (point.x - centerX) / scale,
    y: (point.y - centerY) / scale,
    timestamp: point.timestamp,
  }))
}

function strokeLength(stroke: Stroke): number {
  if (stroke.length < 2) {
    return 0
  }

  let length = 0
  for (let index = 1; index < stroke.length; index += 1) {
    length += distanceBetweenPoints(stroke[index - 1], stroke[index])
  }
  return length
}

function resampleStroke(stroke: Stroke, targetPoints = COMPARISON_POINTS): Stroke {
  if (stroke.length === 0 || targetPoints <= 0) {
    return []
  }

  if (stroke.length === 1) {
    return Array.from({ length: targetPoints }, () => ({ ...stroke[0] }))
  }

  const totalLength = strokeLength(stroke)
  if (totalLength <= EPSILON) {
    return Array.from({ length: targetPoints }, () => ({ ...stroke[0] }))
  }

  const spacing = totalLength / (targetPoints - 1)
  const sampled: Stroke = [{ ...stroke[0] }]

  let previous = { ...stroke[0] }
  let accumulated = 0

  for (let index = 1; index < stroke.length; index += 1) {
    const current = stroke[index]
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

  const tailPoint = { ...stroke[stroke.length - 1] }
  while (sampled.length < targetPoints) {
    sampled.push(tailPoint)
  }

  return sampled
}

export function compareStrokes(strokeA: Stroke, strokeB: Stroke): number {
  if (strokeA.length === 0 || strokeB.length === 0) {
    return 0
  }

  // This point-to-point strategy is intentionally simple, so DTW can replace
  // it later without changing the external compareStrokes API.
  const normalizedA = resampleStroke(normalizeStroke(strokeA))
  const normalizedB = resampleStroke(normalizeStroke(strokeB))

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