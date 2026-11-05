import type { ReactNode } from 'react'
import { SmoothingControl } from '../features/canvas/components/SmoothingControl'
import type { SmoothingSettings, Tool } from '../types/drawing'
import { Button, Divider, rangeClass, Segmented } from './ui'

type ControlBarProps = {
  brushSize: number
  onBrushSizeChange: (size: number) => void
  tool?: Tool
  onToolChange?: (tool: Tool) => void
  smoothing?: SmoothingSettings
  onSmoothingChange?: (smoothing: SmoothingSettings) => void
  onUndo: () => void
  onRedo: () => void
  onClear: () => void
  canUndo: boolean
  canRedo: boolean
  extraControls?: ReactNode
  minBrushSize?: number
  maxBrushSize?: number
  className?: string
  /** Ramka, tło i padding. Osobno od className, bo dopisanie konkurencyjnego tła
   *  rozstrzyga kolejność w wygenerowanym CSS, nie kolejność klas w atrybucie. */
  chromeClassName?: string
}

const TOOL_OPTIONS: { value: Tool; label: string }[] = [
  { value: 'brush', label: 'Pędzel' },
  { value: 'eraser', label: 'Gumka' },
]

export function ControlBar({
  brushSize,
  onBrushSizeChange,
  tool = 'brush',
  onToolChange,
  smoothing,
  onSmoothingChange,
  onUndo,
  onRedo,
  onClear,
  canUndo,
  canRedo,
  extraControls,
  minBrushSize = 1,
  maxBrushSize = 28,
  className = '',
  // Projekt nie daje paskowi własnej karty — kontrolki leżą wprost na blacie.
  chromeClassName = '',
}: ControlBarProps) {
  return (
    <section
      className={`flex flex-wrap items-center gap-x-3.5 gap-y-2.5 ${chromeClassName} ${className}`}
    >
      {onToolChange && (
        <Segmented options={TOOL_OPTIONS} value={tool} onChange={onToolChange} ariaLabel="Narzędzie" />
      )}

      <label className="flex items-center gap-2">
        <span className="text-[13px] text-ink-soft">Rozmiar</span>
        <input
          type="range"
          min={minBrushSize}
          max={maxBrushSize}
          step={1}
          value={brushSize}
          onChange={(event) => onBrushSizeChange(Number(event.target.value))}
          className={`w-24 ${rangeClass}`}
        />
        <span className="w-6 text-right text-xs tabular-nums text-ink-soft">{brushSize}</span>
      </label>

      {smoothing && onSmoothingChange ? (
        <>
          <Divider />
          <SmoothingControl value={smoothing} onChange={onSmoothingChange} />
        </>
      ) : null}

      <Divider />

      <div className="flex items-center gap-0.5">
        <Button variant="ghost" size="sm" onClick={onUndo} disabled={!canUndo} title="Cofnij (Ctrl+Z)">
          Cofnij
        </Button>
        <Button variant="ghost" size="sm" onClick={onRedo} disabled={!canRedo} title="Ponów (Ctrl+Y)">
          Ponów
        </Button>
        <Button variant="danger" size="sm" onClick={onClear}>
          Wyczyść
        </Button>
      </div>

      {extraControls ? <div className="ml-auto flex items-center gap-1">{extraControls}</div> : null}
    </section>
  )
}
