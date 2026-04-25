import type { ReactNode } from 'react'

type ControlBarProps = {
  brushSize: number
  onBrushSizeChange: (size: number) => void
  onUndo: () => void
  onClear: () => void
  extraControls?: ReactNode
}

export function ControlBar({
  brushSize,
  onBrushSizeChange,
  onUndo,
  onClear,
  extraControls,
}: ControlBarProps) {
  return (
    <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-700/70 bg-slate-900/60 p-3">
      <label className="flex items-center gap-2 text-sm text-slate-200">
        <span className="font-medium">Brush</span>
        <input
          type="range"
          min={1}
          max={28}
          step={1}
          value={brushSize}
          onChange={(event) => onBrushSizeChange(Number(event.target.value))}
          className="h-2 w-36 cursor-pointer accent-cyan-400"
        />
        <span className="w-8 text-right text-slate-300">{brushSize}</span>
      </label>

      <button
        type="button"
        onClick={onUndo}
        className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-100 transition hover:border-slate-400"
      >
        Undo
      </button>

      <button
        type="button"
        onClick={onClear}
        className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-100 transition hover:border-slate-400"
      >
        Clear
      </button>

      {extraControls ? <div className="ml-auto flex items-center gap-2">{extraControls}</div> : null}
    </section>
  )
}