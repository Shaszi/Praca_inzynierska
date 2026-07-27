import type { ReactNode } from 'react'
import type { Tool } from '../types/drawing'

type ControlBarProps = {
  brushSize: number
  onBrushSizeChange: (size: number) => void
  tool?: Tool
  onToolChange?: (tool: Tool) => void
  onUndo: () => void
  onRedo: () => void
  onClear: () => void
  canUndo: boolean
  canRedo: boolean
  extraControls?: ReactNode
}

export function ControlBar({
  brushSize,
  onBrushSizeChange,
  tool = 'brush',
  onToolChange,
  onUndo,
  onRedo,
  onClear,
  canUndo,
  canRedo,
  extraControls,
}: ControlBarProps) {
  return (
    <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-300 bg-white p-3 shadow-sm">
      {onToolChange && (
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 p-1">
          <button
            type="button"
            onClick={() => onToolChange('brush')}
            title="Pędzel"
            className={`rounded-md px-3 py-1 text-sm font-medium transition ${
              tool === 'brush'
                ? 'bg-sky-500 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Pędzel
          </button>
          <button
            type="button"
            onClick={() => onToolChange('eraser')}
            title="Gumka"
            className={`rounded-md px-3 py-1 text-sm font-medium transition ${
              tool === 'eraser'
                ? 'bg-rose-500 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Gumka
          </button>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <span className="font-medium">{tool === 'eraser' ? 'Rozmiar gumki' : 'Pędzel'}</span>
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
        disabled={!canUndo}
        className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
          canUndo
            ? 'border-slate-300 bg-slate-50 text-slate-700 hover:border-slate-400'
            : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
        }`}
      >
        Cofnij
      </button>
      <button
        type="button"
        onClick={onRedo}
        disabled={!canRedo}
        className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
          canRedo
            ? 'border-slate-300 bg-slate-50 text-slate-700 hover:border-slate-400'
            : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
        }`}
      >
        Ponów
      </button>

      <button
        type="button"
        onClick={onClear}
        className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400"
      >
        Wyczyść
      </button>

      {extraControls ? <div className="ml-auto flex items-center gap-2">{extraControls}</div> : null}
    </section>
  )
}
