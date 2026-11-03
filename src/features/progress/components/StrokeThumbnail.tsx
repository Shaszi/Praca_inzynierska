import { useMemo } from 'react'
import type { Stroke } from '../../../types/drawing'

const SIZE = 100
const PADDING = 8

// Miniatura rysunku jako SVG, dopasowana do obrysu wszystkich kresek.
export function StrokeThumbnail({ strokes, className = '' }: { strokes: Stroke[]; className?: string }) {
  const paths = useMemo(() => {
    const points = strokes.flatMap((stroke) => stroke.points)
    if (points.length === 0) return []

    const xs = points.map((p) => p.x)
    const ys = points.map((p) => p.y)
    const minX = Math.min(...xs)
    const minY = Math.min(...ys)
    const width = Math.max(Math.max(...xs) - minX, 1)
    const height = Math.max(Math.max(...ys) - minY, 1)
    const scale = (SIZE - PADDING * 2) / Math.max(width, height)
    const offsetX = (SIZE - width * scale) / 2
    const offsetY = (SIZE - height * scale) / 2

    return strokes.map((stroke) => ({
      width: Math.max(stroke.brushSize * scale, 0.8),
      d: stroke.points
        .map((p, i) => `${i === 0 ? 'M' : 'L'}${((p.x - minX) * scale + offsetX).toFixed(1)} ${((p.y - minY) * scale + offsetY).toFixed(1)}`)
        .join(''),
    }))
  }, [strokes])

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className={className} aria-hidden>
      {paths.map((path, index) => (
        <path
          key={index}
          d={path.d}
          fill="none"
          strokeWidth={path.width}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-ink"
        />
      ))}
    </svg>
  )
}
