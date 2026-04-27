import type { GuideType, Tool } from '../../../types/drawing'

type CursorPreview = {
  x: number
  y: number
  visible: boolean
}

type CanvasOverlayProps = {
  guide?: GuideType | null
  showCursorPreview: boolean
  cursorPreview: CursorPreview
  brushSize: number
  tool: Tool
}

function GuideLayer({ guide }: { guide: GuideType }) {
  return (
    <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
      {guide === 'line' ? (
        <line
          x1="12"
          y1="50"
          x2="88"
          y2="50"
          stroke="#0ea5e9"
          strokeWidth="1"
          strokeDasharray="3 2"
          opacity="0.45"
        />
      ) : (
        <circle
          cx="50"
          cy="50"
          r="24"
          fill="none"
          stroke="#0ea5e9"
          strokeWidth="1"
          strokeDasharray="3 2"
          opacity="0.45"
        />
      )}
    </svg>
  )
}

export function CanvasOverlay({
  guide,
  showCursorPreview,
  cursorPreview,
  brushSize,
  tool,
}: CanvasOverlayProps) {
  return (
    <>
      {guide ? <div className="pointer-events-none absolute inset-0"><GuideLayer guide={guide} /></div> : null}
      {showCursorPreview && cursorPreview.visible ? (
        <div
          className={`pointer-events-none absolute rounded-full border ${tool === 'eraser' ? 'border-rose-400/80 bg-rose-100/20' : 'border-sky-400/70'}`}
          style={{
            width: `${brushSize * 2}px`,
            height: `${brushSize * 2}px`,
            left: `${cursorPreview.x - brushSize}px`,
            top: `${cursorPreview.y - brushSize}px`,
          }}
        />
      ) : null}
    </>
  )
}