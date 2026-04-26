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
    <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-300 bg-white p-3 shadow-sm">
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <span className="font-medium">Brush</span>
        <input
          type="range"
          min={1}
          max={28}
          step={1}
          value={brushSize}
          onChange={(event) => onBrushSizeChange(Number(event.target.value))}
          className="h-2 w-36 cursor-pointer accent-sky-500"
        />
        <span className="w-8 text-right text-slate-500">{brushSize}</span>
      </label>

      <button
        type="button"
        onClick={onUndo}
        className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400"
      >
        Undo
      </button>

      <button
        type="button"
        onClick={onClear}
        className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400"
      >
        Clear
      </button>

      {extraControls ? <div className="ml-auto flex items-center gap-2">{extraControls}</div> : null}
    </section>
  )
}
