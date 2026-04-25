import type { GuideType } from '../types/drawing'

type GuideOverlayProps = {
  guide: GuideType
}

export function GuideOverlay({ guide }: GuideOverlayProps) {
  return (
    <div className="pointer-events-none absolute inset-0">
      <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {guide === 'line' ? (
          <line
            x1="12"
            y1="50"
            x2="88"
            y2="50"
            stroke="#38bdf8"
            strokeWidth="1"
            strokeDasharray="3 2"
            opacity="0.7"
          />
        ) : (
          <circle
            cx="50"
            cy="50"
            r="24"
            fill="none"
            stroke="#38bdf8"
            strokeWidth="1"
            strokeDasharray="3 2"
            opacity="0.7"
          />
        )}
      </svg>
    </div>
  )
}