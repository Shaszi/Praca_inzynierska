import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Button, Segmented } from '../../../components/ui'
import { EditableTitle } from './EditableTitle'
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

function ArrowIcon({ redo = false }: { redo?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={redo ? { transform: 'scaleX(-1)' } : undefined}>
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h10a6 6 0 010 12h-3" />
    </svg>
  )
}

function MenuItem({
  onClick,
  children,
  disabled = false,
  pressed,
  danger = false,
}: {
  onClick: () => void
  children: ReactNode
  disabled?: boolean
  pressed?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      role={pressed === undefined ? 'menuitem' : 'menuitemcheckbox'}
      aria-checked={pressed}
      disabled={disabled}
      onClick={onClick}
      className={`flex min-h-11 items-center gap-2 rounded-[12px] px-3 text-left text-[14.5px] font-semibold transition hover:bg-surface-dim disabled:opacity-40 ${
        danger ? 'text-danger' : pressed ? 'text-accent' : 'text-ink'
      }`}
    >
      {children}
    </button>
  )
}

export function PracticeToolbar({
  tool,
  onToolChange,
  title,
  onRenameTitle,
  stepIndex,
  stepsTotal,
  isLayersOpen = false,
  onToggleLayers,
  onOpenBrush,
  isBrushOpen,
  brushColor,
  onStepBack,
  canStepBack = false,
  stepNoun = 'Kreska',
  onUndo,
  onRedo,
  onClear,
  onRotate,
  onResetRotation,
  canUndo,
  canRedo,
  isFullscreen,
  onToggleFullscreen,
}: {
  tool: Tool
  onToolChange: (tool: Tool) => void
  title: string
  onRenameTitle?: (title: string) => Promise<void>
  stepIndex: number
  stepsTotal: number
  isLayersOpen?: boolean
  onToggleLayers?: () => void
  onOpenBrush: () => void
  isBrushOpen: boolean
  brushColor: string
  onStepBack?: () => void
  canStepBack?: boolean
  stepNoun?: string
  onUndo: () => void
  onRedo: () => void
  onClear: () => void
  onRotate?: (degrees: number) => void
  onResetRotation?: () => void
  canUndo: boolean
  canRedo: boolean
  isFullscreen: boolean
  onToggleFullscreen: () => void
}) {
  const current = Math.min(stepIndex, Math.max(stepsTotal - 1, 0))
  // Pozycja menu na ekranie, null = zamknięte. Menu idzie przez portal do <body>:
  // w panelu pełnego ekranu (overflow, z-index) było przycinane i chowało się pod kanwą.
  const [menuAt, setMenuAt] = useState<{ top: number; right: number } | null>(null)
  const isMoreOpen = menuAt !== null
  const setIsMoreOpen = (open: boolean) => {
    const rect = moreRef.current?.getBoundingClientRect()
    setMenuAt(open && rect ? { top: rect.bottom + 8, right: window.innerWidth - rect.right } : null)
  }
  const moreRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const pick = (action: () => void) => () => {
    setMenuAt(null)
    action()
  }

  useEffect(() => {
    if (!isMoreOpen) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (!moreRef.current?.contains(target) && !menuRef.current?.contains(target)) setMenuAt(null)
    }
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && setMenuAt(null)
    const close = () => setMenuAt(null)
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [isMoreOpen])

  return (
    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2.5">
      <Segmented options={TOOL_OPTIONS} value={tool} onChange={onToolChange} ariaLabel="Narzędzie" />

      {title && (onRenameTitle ? (
        <EditableTitle title={title} onRename={onRenameTitle} className="font-semibold" />
      ) : (
        <span className="font-semibold">{title}</span>
      ))}

      {stepsTotal > 0 && (
        <>
          <span className="font-mono text-sm text-ink-faint">
            {stepNoun} {current + 1} z {stepsTotal}
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

      <span className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={onUndo} disabled={!canUndo} title="Cofnij (Ctrl+Z)" aria-label="Cofnij">
          <ArrowIcon />
        </Button>
        <Button variant="ghost" size="sm" onClick={onRedo} disabled={!canRedo} title="Ponów (Ctrl+Y)" aria-label="Ponów">
          <ArrowIcon redo />
        </Button>
      </span>

      <Button variant="ghost" size="sm" onClick={onOpenBrush} aria-expanded={isBrushOpen} aria-controls="brush-panel">
        <span
          className="h-3 w-3 rounded-full border-2 border-[rgb(255_255_255_/_0.3)]"
          style={{ background: brushColor }}
          aria-hidden
        />
        Kolor
      </Button>

      <div ref={moreRef} className="relative">
        <Button variant="ghost" size="sm" onClick={() => setIsMoreOpen(!isMoreOpen)} aria-expanded={isMoreOpen} aria-haspopup="menu">
          Więcej
        </Button>
        {menuAt && createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={menuAt}
            className="fixed z-[80] flex w-56 flex-col gap-1 rounded-[18px] border border-line bg-surface p-2 shadow-xl"
          >
            {onToggleLayers && (
              <MenuItem onClick={pick(onToggleLayers)} pressed={isLayersOpen}>
                <LayersIcon /> Warstwy
              </MenuItem>
            )}
            {onStepBack && (
              <MenuItem onClick={pick(onStepBack)} disabled={!canStepBack}>
                Krok w tył
              </MenuItem>
            )}
            <MenuItem onClick={pick(onToggleFullscreen)} pressed={isFullscreen}>
              <ExpandIcon collapsed={isFullscreen} /> {isFullscreen ? 'Wyjdź z pełnego ekranu' : 'Pełny ekran'}
            </MenuItem>
            {onRotate && (
              <>
                <MenuItem onClick={pick(() => onRotate(-15))}>↺ Obróć w lewo</MenuItem>
                <MenuItem onClick={pick(() => onRotate(15))}>↻ Obróć w prawo</MenuItem>
              </>
            )}
            {onResetRotation && <MenuItem onClick={pick(onResetRotation)}>Wyprostuj płótno</MenuItem>}
            <MenuItem onClick={pick(onClear)} danger>
              Wyczyść płótno
            </MenuItem>
          </div>,
          document.body,
        )}
      </div>
    </div>
  )
}
