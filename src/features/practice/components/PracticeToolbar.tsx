import { Button, Segmented } from '../../../components/ui'
import type { Tool } from '../../../types/drawing'

const TOOL_OPTIONS: { value: Tool; label: string }[] = [
  { value: 'brush', label: 'Pędzel' },
  { value: 'eraser', label: 'Gumka' },
]

function LayersIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" aria-hidden>
      <path d="M12 3l9 5-9 5-9-5z" />
      <path d="M3 13l9 5 9-5" />
    </svg>
  )
}

function ExpandIcon({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
      {collapsed ? (
        <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
      ) : (
        <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
      )}
    </svg>
  )
}

/** Pasek nad kanwą, dokładnie jak `.toolbar` w sekcji „Ekran ćwiczeń na komputerze". */
export function PracticeToolbar({
  tool,
  onToolChange,
  title,
  stepIndex,
  stepsTotal,
  isLayersOpen,
  onToggleLayers,
  onOpenBrush,
  isBrushOpen,
  onUndo,
  onRedo,
  onClear,
  canUndo,
  canRedo,
  isFullscreen,
  onToggleFullscreen,
}: {
  tool: Tool
  onToolChange: (tool: Tool) => void
  title: string
  /** Numer kroku liczony od zera. */
  stepIndex: number
  stepsTotal: number
  isLayersOpen: boolean
  onToggleLayers: () => void
  onOpenBrush: () => void
  isBrushOpen: boolean
  onUndo: () => void
  onRedo: () => void
  onClear: () => void
  canUndo: boolean
  canRedo: boolean
  isFullscreen: boolean
  onToggleFullscreen: () => void
}) {
  const current = Math.min(stepIndex, Math.max(stepsTotal - 1, 0))

  return (
    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2.5">
      <Segmented options={TOOL_OPTIONS} value={tool} onChange={onToolChange} ariaLabel="Narzędzie" />

      {title && <span className="font-semibold">{title}</span>}

      {stepsTotal > 0 && (
        <>
          <span className="font-mono text-sm text-ink-faint">
            Kreska {current + 1} z {stepsTotal}
          </span>
          {stepsTotal <= 24 && (
            <span className="flex items-center gap-1" aria-hidden>
              {Array.from({ length: stepsTotal }, (_, index) => (
                <i
                  key={index}
                  className={[
                    'block h-1.5 rounded-full transition-all',
                    index < stepIndex ? 'w-4 bg-success' : index === stepIndex ? 'w-[26px] bg-accent' : 'w-4 bg-surface-dim',
                  ].join(' ')}
                />
              ))}
            </span>
          )}
        </>
      )}

      <Button
        variant="ghost"
        size="sm"
        className="ml-auto"
        onClick={onOpenBrush}
        aria-expanded={isBrushOpen}
        aria-controls="brush-panel"
      >
        <span
          className="h-3 w-3 rounded-full border-2 border-[rgb(255_255_255_/_0.3)]"
          style={{ background: 'var(--brush-color, #3ee6a8)' }}
          aria-hidden
        />
        Kolor
      </Button>

      <Button variant="ghost" size="sm" onClick={onToggleLayers} aria-pressed={isLayersOpen}>
        <LayersIcon />
        Warstwy
      </Button>

      <Button variant="ghost" size="sm" onClick={onToggleFullscreen} aria-pressed={isFullscreen}>
        <ExpandIcon collapsed={isFullscreen} />
        {isFullscreen ? 'Wyjdź' : 'Pełny ekran'}
      </Button>

      {/* Projekt nie ma cofania w tym pasku, ale bez niego byłaby to regresja funkcji. */}
      <span className="flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={onUndo} disabled={!canUndo} title="Cofnij (Ctrl+Z)">
          Cofnij
        </Button>
        <Button variant="ghost" size="sm" onClick={onRedo} disabled={!canRedo} title="Ponów (Ctrl+Y)">
          Ponów
        </Button>
        <Button variant="danger" size="sm" onClick={onClear}>
          Wyczyść
        </Button>
      </span>
    </div>
  )
}
