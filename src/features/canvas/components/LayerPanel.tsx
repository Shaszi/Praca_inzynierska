import type { Layer, Stroke } from '../../../types/drawing'
import { StrokeThumbnail } from '../../progress/components/StrokeThumbnail'

// Baza bez kolorów. Każdy wariant podaje własne tło, ramkę i kolor tekstu — dopisywanie
// drugiej klasy koloru do gotowej bazy rozstrzyga kolejność w wygenerowanym CSS, nie
// kolejność w atrybucie, więc tekst potrafi wyjść niewidoczny.
const miniBase = 'min-h-9 rounded-full border px-3 text-[13px] font-semibold disabled:opacity-35'
const miniQuiet = `${miniBase} border-line-strong bg-transparent text-ink`
const miniAdd = `${miniBase} border-accent bg-accent text-on-accent`
const miniDanger = `${miniBase} border-[rgb(255_107_133_/_0.45)] bg-transparent text-danger`

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      {open ? (
        <>
          <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" />
          <circle cx="12" cy="12" r="2.8" />
        </>
      ) : (
        <>
          <path d="M3 3l18 18" strokeLinecap="round" />
          <path d="M6.5 7.3C4 9 2 12 2 12s3.5 6 10 6c2 0 3.7-.5 5.1-1.3M20 14.5c1.3-1.3 2-2.5 2-2.5s-3.5-6-10-6c-.6 0-1.2 0-1.7.1" />
        </>
      )}
    </svg>
  )
}

function LockIcon({ locked }: { locked: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      {locked ? <path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5" /> : <path d="M8.5 10.5V8a3.5 3.5 0 016.7-1.4" />}
    </svg>
  )
}

/** Szachownica pod miniaturą — pokazuje, że warstwa jest przezroczysta. */
const CHECKER = {
  backgroundColor: '#2b2662',
  backgroundImage: 'conic-gradient(#36317a 25%, transparent 0 50%, #36317a 0 75%, transparent 0)',
  backgroundSize: '12px 12px',
}

function LayerRow({
  layer,
  isActive,
  isOnly,
  score,
  onSelect,
  onToggleVisible,
  onToggleLock,
  onOpacity,
  onMove,
  onRemove,
}: {
  layer: Layer
  isActive: boolean
  isOnly: boolean
  score: number | null
  onSelect: () => void
  onToggleVisible: () => void
  onToggleLock: () => void
  onOpacity: (value: number) => void
  onMove: (direction: -1 | 1) => void
  onRemove: () => void
}) {
  const dimmed = layer.visible ? '' : 'opacity-40'

  return (
    <li
      className={[
        'rounded-[16px] border-2 p-1.5',
        isActive ? 'border-violet bg-surface-dim' : 'border-transparent bg-paper-dim',
      ].join(' ')}
    >
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onSelect}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-[12px] p-0.5 text-left"
          aria-pressed={isActive}
        >
          <span className={`grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-[10px] ${dimmed}`} style={CHECKER}>
            {layer.strokes.length > 0 ? (
              <StrokeThumbnail strokes={layer.strokes} className="h-full w-full" />
            ) : null}
          </span>
          <span className={`min-w-0 ${dimmed}`}>
            <b className="block truncate text-[14.5px] font-semibold">{layer.name}</b>
            <small className={`block truncate text-[12.5px] ${score !== null ? 'text-success' : 'text-ink-faint'}`}>
              {score !== null
                ? `${score} pkt`
                : layer.locked
                  ? 'zablokowana'
                  : `${layer.strokes.length} ${layer.strokes.length === 1 ? 'kreska' : 'kresek'}`}
            </small>
          </span>
        </button>

        <button
          type="button"
          onClick={onToggleVisible}
          aria-pressed={layer.visible}
          aria-label={layer.visible ? `Ukryj ${layer.name}` : `Pokaż ${layer.name}`}
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-[12px] text-ink-soft hover:bg-surface ${
            layer.visible ? '' : 'text-ink-faint opacity-55'
          }`}
        >
          <EyeIcon open={layer.visible} />
        </button>

        <button
          type="button"
          onClick={onToggleLock}
          aria-pressed={layer.locked === true}
          aria-label={layer.locked ? `Odblokuj ${layer.name}` : `Zablokuj ${layer.name}`}
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-[12px] hover:bg-surface ${
            layer.locked ? 'text-orange' : 'text-ink-faint opacity-55'
          }`}
        >
          <LockIcon locked={layer.locked === true} />
        </button>
      </div>

      {/* Suwak, kolejność i usuwanie pojawiają się dopiero po wybraniu warstwy — reguła z projektu. */}
      {isActive && (
        <div className="flex flex-col gap-2.5 px-1 pt-2.5 pb-1">
          <label className="flex flex-col gap-1.5 text-[13px] text-ink-soft">
            <span className="flex justify-between">
              Krycie <span className="font-mono text-ink-faint">{Math.round(layer.opacity * 100)}%</span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(layer.opacity * 100)}
              onChange={(event) => onOpacity(Number(event.target.value) / 100)}
              className="h-7 w-full cursor-pointer accent-[var(--color-violet)]"
            />
          </label>
          <div className="flex gap-1.5">
            <button type="button" className={miniQuiet} onClick={() => onMove(1)}>
              Wyżej
            </button>
            <button type="button" className={miniQuiet} onClick={() => onMove(-1)}>
              Niżej
            </button>
            <button
              type="button"
              onClick={onRemove}
              disabled={isOnly || layer.locked}
              className={miniDanger}
            >
              Usuń
            </button>
          </div>
          {layer.locked && <p className="m-0 text-[12.5px] text-ink-faint">Wzorzec jest zablokowany — nie da się na nim rysować.</p>}
        </div>
      )}
    </li>
  )
}

export function LayerPanel({
  layers,
  activeLayerId,
  guideOpacity,
  onGuideOpacity,
  guideStrokes,
  onSelect,
  onToggleVisible,
  onToggleLock,
  onOpacity,
  onMove,
  onRemove,
  onAdd,
}: {
  layers: Layer[]
  activeLayerId: string
  /** Krycie wzorca — w projekcie „Wzorzec" jest zablokowaną warstwą na spodzie. */
  guideOpacity: number
  onGuideOpacity: (value: number) => void
  guideStrokes: Stroke[]
  onSelect: (id: string) => void
  onToggleVisible: (id: string) => void
  onToggleLock: (id: string) => void
  onOpacity: (id: string, value: number) => void
  onMove: (id: string, direction: -1 | 1) => void
  onRemove: (id: string) => void
  onAdd: () => void
}) {
  // Od góry w panelu = od góry na kanwie, więc kolejność odwracamy.
  const ordered = [...layers].reverse()

  return (
    <div className="flex flex-col gap-1.5">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h3 className="font-display text-[16px] font-bold tracking-[-0.01em] text-ink">Warstwy</h3>
        <button type="button" onClick={onAdd} className={miniAdd}>
          Dodaj
        </button>
      </div>

      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {ordered.map((layer) => (
          <LayerRow
            key={layer.id}
            layer={layer}
            isActive={layer.id === activeLayerId}
            isOnly={layers.length <= 1}
            score={null}
            onSelect={() => onSelect(layer.id)}
            onToggleVisible={() => onToggleVisible(layer.id)}
            onToggleLock={() => onToggleLock(layer.id)}
            onOpacity={(value) => onOpacity(layer.id, value)}
            onMove={(direction) => onMove(layer.id, direction)}
            onRemove={() => onRemove(layer.id)}
          />
        ))}

        {/* Wzorzec zawsze na spodzie, zablokowany, z własnym suwakiem przyciemnienia. */}
        <li className="rounded-[16px] border-2 border-transparent bg-paper-dim p-1.5">
          <div className="flex items-center gap-1.5">
            <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-[10px]" style={CHECKER}>
              {guideStrokes.length > 0 ? <StrokeThumbnail strokes={guideStrokes} className="h-full w-full" /> : null}
            </span>
            <span className="min-w-0 flex-1">
              <b className="block truncate text-[14.5px] font-semibold">Wzorzec</b>
              <small className="block text-[12.5px] text-ink-faint">zablokowany</small>
            </span>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] text-orange" aria-hidden>
              <LockIcon locked />
            </span>
          </div>
          <label className="flex flex-col gap-1.5 px-1 pt-2.5 pb-1 text-[13px] text-ink-soft">
            <span className="flex justify-between">
              Przyciemnienie <span className="font-mono text-ink-faint">{Math.round(guideOpacity * 100)}%</span>
            </span>
            <input
              type="range"
              min={10}
              max={100}
              value={Math.round(guideOpacity * 100)}
              onChange={(event) => onGuideOpacity(Number(event.target.value) / 100)}
              className="h-7 w-full cursor-pointer accent-[var(--color-violet)]"
            />
          </label>
        </li>
      </ul>
    </div>
  )
}
