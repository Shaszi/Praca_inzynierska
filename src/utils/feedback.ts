import type { Stroke } from '../types/drawing'
import { distanceBetweenPoints } from './analysis'

const MIN_SPEED = 0.12
const MAX_SPEED = 2.1
const UNEVEN_RATIO = 1.35

function getPathLength(stroke: Stroke): number {
  if (stroke.points.length < 2) {
    return 0
  }

  let totalLength = 0
  for (let index = 1; index < stroke.points.length; index += 1) {
    totalLength += distanceBetweenPoints(stroke.points[index - 1], stroke.points[index])
  }

  return totalLength
}

export function getFeedback(stroke: Stroke): string {
  if (stroke.points.length < 3) {
    return 'Try smoother motion'
  }

  const pathLength = getPathLength(stroke)
  const directDistance = distanceBetweenPoints(
    stroke.points[0],
    stroke.points[stroke.points.length - 1],
  )
  const movementRatio = directDistance > 0 ? pathLength / directDistance : Infinity

  if (movementRatio > UNEVEN_RATIO) {
    return 'Line is uneven'
  }

  const duration = Math.max(
    stroke.points[stroke.points.length - 1].timestamp - stroke.points[0].timestamp,
    1,
  )
  const speed = pathLength / duration

  if (speed < MIN_SPEED || speed > MAX_SPEED) {
    return 'Try smoother motion'
  }

  return 'Good control'
}