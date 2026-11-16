import { useRef, useState, type PointerEvent } from 'react'

type Point = { x: number; y: number }

export function LassoSurface({
  width,
  height,
  loop,
  onComplete,
}: {
  width: number
  height: number
  loop: Point[] | null
  onComplete: (points: Point[]) => void
}) {
  const [draft, setDraft] = useState<Point[] | null>(null)
  const draftRef = useRef<Point[]>([])
  const step = Math.max(width, height) * 0.004

  const toImage = (event: PointerEvent<SVGSVGElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect()
    return {
      x: Math.min(width, Math.max(0, ((event.clientX - rect.left) / rect.width) * width)),
      y: Math.min(height, Math.max(0, ((event.clientY - rect.top) / rect.height) * height)),
    }
  }

  const finish = () => {
    const points = draftRef.current
    draftRef.current = []
    setDraft(null)
    if (points.length >= 3) onComplete(points)
  }

  const shown = draft ?? loop
  const path = shown?.map((p) => `${p.x},${p.y}`).join(' ') ?? ''
  const stroke = Math.max(width, height) * 0.004

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="absolute inset-0 h-full w-full cursor-crosshair touch-none rounded-[18px]"
      aria-label="Obrysuj obiekt, który chcesz narysować"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId)
        draftRef.current = [toImage(event)]
        setDraft(draftRef.current)
      }}
      onPointerMove={(event) => {
        if (draftRef.current.length === 0) return
        const point = toImage(event)
        const last = draftRef.current[draftRef.current.length - 1]
        if (Math.hypot(point.x - last.x, point.y - last.y) < step) return
        draftRef.current = [...draftRef.current, point]
        setDraft(draftRef.current)
      }}
      onPointerUp={finish}
      onPointerCancel={finish}
    >
      {shown && shown.length > 1 && (
        <polygon
          points={path}
          fill={draft ? 'none' : 'rgb(62 230 168 / 0.35)'}
          stroke="#3ee6a8"
          strokeWidth={stroke}
          strokeLinejoin="round"
          strokeDasharray={draft ? `${stroke * 3} ${stroke * 2}` : undefined}
        />
      )}
    </svg>
  )
}
