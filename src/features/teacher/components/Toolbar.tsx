import type { Tool } from '../../../types/drawing'

type ToolbarProps = {
  tool: Tool
  brushSize: number
  isCanvasFullscreen: boolean
  onToolChange: (tool: Tool) => void
  onBrushSizeChange: (size: number) => void
  onUndo: () => void
  onRedo: () => void
  onClear: () => void
  canUndo: boolean
  canRedo: boolean
  onToggleCanvasFullscreen: () => void
}

export function Toolbar({
  tool,
  brushSize,
  isCanvasFullscreen,
  onToolChange,
  onBrushSizeChange,
  onUndo,
  onRedo,
  onClear,
  canUndo,
  canRedo,
  onToggleCanvasFullscreen,
}: ToolbarProps) {
  const buttonBase =
    'rounded-lg border px-3 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-sky-200'

  return (
    <aside className="flex w-60 shrink-0 flex-col gap-4 rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Tools</p>
        <div className="mt-2 grid gap-2">
          <button
            type="button"
            onClick={() => onToolChange('brush')}
            className={`${buttonBase} ${tool === 'brush' ? 'border-sky-300 bg-sky-50 text-sky-700' : 'border-slate-300 bg-slate-50 text-slate-700 hover:border-slate-400'}`}
          >
            Brush
          </button>
          <button
            type="button"
            onClick={() => onToolChange('eraser')}
            className={`${buttonBase} ${tool === 'eraser' ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-slate-300 bg-slate-50 text-slate-700 hover:border-slate-400'}`}
          >
            Eraser
          </button>
        </div>
      </div>

      <label className="block text-sm text-slate-700">
        <span className="font-medium">Size</span>
        <input
          type="range"
          min={2}
          max={48}
          step={1}
          value={brushSize}
          onChange={(event) => onBrushSizeChange(Number(event.target.value))}
          className="mt-2 h-2 w-full cursor-pointer accent-sky-500"
        />
        <span className="mt-1 block text-xs text-slate-500">{brushSize}px</span>
      </label>

      <div className="mt-auto grid gap-2">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
            canUndo
              ? 'border-slate-300 bg-slate-50 text-slate-700 hover:border-slate-400'
              : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
          }`}
        >
          Undo
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
            canRedo
              ? 'border-slate-300 bg-slate-50 text-slate-700 hover:border-slate-400'
              : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
          }`}
        >
          Redo
        </button>
        <button
          type="button"
          onClick={onClear}
          className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={onToggleCanvasFullscreen}
          className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
            isCanvasFullscreen
              ? 'border-sky-300 bg-sky-50 text-sky-700'
              : 'border-slate-300 bg-slate-50 text-slate-700 hover:border-slate-400'
          }`}
        >
          Fullscreen Canvas
        </button>
      </div>
    </aside>
  )
}
