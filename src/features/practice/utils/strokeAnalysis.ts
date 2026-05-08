import type { Point, Stroke } from '../../../types/drawing'
import { findNearestDistance } from './geometry'

const EPSILON = 1e-6
const MAX_DISTANCE_FOR_ZERO_SCORE = 0.45

export type StrokeSimilarityResult = {
  score: number
  averageDistance: number
  feedback: string
}

export function normalizeStroke(stroke: Stroke): Stroke {
  if (stroke.points.length === 0) {
    return { ...stroke, points: [] }
  }

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  for (const point of stroke.points) {
    minX = Math.min(minX, point.x)
    maxX = Math.max(maxX, point.x)
    minY = Math.min(minY, point.y)
    maxY = Math.max(maxY, point.y)
  }

  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2
  const scale = Math.max(maxX - minX, maxY - minY, EPSILON)

  const normalizedPoints: Point[] = stroke.points.map((point) => ({
    x: (point.x - centerX) / scale,
    y: (point.y - centerY) / scale,
    timestamp: point.timestamp,
  }))

  return {
    brushSize: stroke.brushSize,
    points: normalizedPoints,
  }
}

function getFeedbackForScore(score: number, averageDistance: number): string {
  if (score >= 90) return 'Very accurate'
  if (score >= 75) return 'Good alignment'
  if (score >= 55) return 'Stroke shape differs'
  if (averageDistance < Infinity) return 'Too far from reference'
  return 'Draw over the guide to get feedback.'
}

export function calculateStrokeSimilarity(
  userStroke: Stroke,
  referenceStroke: Stroke,
): StrokeSimilarityResult {
  if (userStroke.points.length === 0 || referenceStroke.points.length === 0) {
    return {
      score: 0,
      averageDistance: Infinity,
      feedback: 'Draw over the guide to get feedback.',
    }
  }

  const normalizedUser = normalizeStroke(userStroke)
  const normalizedReference = normalizeStroke(referenceStroke)

  let totalDistance = 0
  for (const userPoint of normalizedUser.points) {
    totalDistance += findNearestDistance(userPoint, normalizedReference.points)
  }

  const averageDistance = totalDistance / normalizedUser.points.length
  const clamped = Math.min(averageDistance / MAX_DISTANCE_FOR_ZERO_SCORE, 1)
  const score = Math.round((1 - clamped) * 100)

  return {
    score,
    averageDistance,
    feedback: getFeedbackForScore(score, averageDistance),
  }
}
