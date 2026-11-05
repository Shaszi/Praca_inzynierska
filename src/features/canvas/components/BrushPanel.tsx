import { contrastRatio } from '../../../utils/contrast'
import { BRUSH_SWATCHES, type BrushSettings } from '../hooks/useBrushSettings'

/** Poniżej tego kontrastu kreska zlewa się z kartką — projekt każe wtedy ostrzec. */
const MIN_VISIBLE_CONTRAST = 1.6

export function BrushPanel({
  brush,
  onChange,
  canvasBackground,
  id = 'brush-panel',
}: {
  brush: BrushSettings
  onChange: (next: BrushSettings) => void
  /** Kolor kartki, żeby dało się ostrzec, gdy pędzel na niej znika. */
  canvasBackground: string
  id?: string
}) {
  const invisible = contrastRatio(brush.color, canvasBackground) < MIN_VISIBLE_CONTRAST

  return (
    <div
      id={id}
      className="flex w-[330px] max-w-full flex-col gap-4 rounded-[22px] border border-line-strong bg-surface p-4 shadow-[var(--shadow-float)]"
    >
      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold text-ink-soft">Podgląd</span>
        <div
          className="overflow-hidden rounded-[16px] border border-line bg-paper-dim"
          style={{ backgroundImage: 'var(--canvas-dots)', backgroundSize: '22px 22px' }}
        >
          <svg viewBox="0 0 280 72" className="block h-auto w-full" aria-hidden>
            <path
              d="M18 48 C 60 18, 110 58, 150 36 S 230 16, 262 30"
              fill="none"
              stroke={brush.color}
              strokeWidth={brush.width}
              strokeOpacity={brush.opacity}
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold text-ink-soft">Kolor</span>
        <div className="grid grid-cols-9 gap-[7px]">
          {BRUSH_SWATCHES.map((swatch) => (
            <button
              key={swatch.color}
              type="button"
              title={swatch.name}
              aria-label={swatch.name}
              aria-pressed={brush.color.toLowerCase() === swatch.color.toLowerCase()}
              onClick={() => onChange({ ...brush, color: swatch.color })}
              className={[
                'block aspect-square w-full rounded-full border-2 p-0',
                // Grafit na ciemnej karcie potrzebuje jaśniejszej ramki, żeby był widoczny.
                swatch.color === '#1a1236' ? 'border-[#6f68a8]' : 'border-line-strong',
                brush.color.toLowerCase() === swatch.color.toLowerCase()
                  ? 'shadow-[0_0_0_3px_var(--color-surface),0_0_0_5px_var(--color-ink)]'
                  : '',
              ].join(' ')}
              style={{ background: swatch.color }}
            />
          ))}

          <label
            className="relative block aspect-square w-full overflow-hidden rounded-full border-2 border-line-strong"
            style={{ background: 'conic-gradient(#ff5fa8,#ffd84a,#3ee6a8,#4fd2ff,#9d7dff,#ff5fa8)' }}
            title="Własny kolor"
          >
            <span className="sr-only">Własny kolor</span>
            <input
              type="color"
              value={brush.color}
              onChange={(event) => onChange({ ...brush, color: event.target.value })}
              className="absolute inset-0 h-full w-full cursor-pointer border-0 p-0 opacity-0"
            />
          </label>
        </div>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="flex justify-between text-[13px] font-semibold text-ink-soft">
          Grubość <span className="font-mono text-ink-faint">{brush.width} px</span>
        </span>
        <input
          type="range"
          min={1}
          max={40}
          value={brush.width}
          onChange={(event) => onChange({ ...brush, width: Number(event.target.value) })}
          className="h-7 w-full cursor-pointer accent-[var(--color-accent)]"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="flex justify-between text-[13px] font-semibold text-ink-soft">
          Krycie <span className="font-mono text-ink-faint">{Math.round(brush.opacity * 100)}%</span>
        </span>
        <input
          type="range"
          min={10}
          max={100}
          value={Math.round(brush.opacity * 100)}
          onChange={(event) => onChange({ ...brush, opacity: Number(event.target.value) / 100 })}
          className="h-7 w-full cursor-pointer accent-[var(--color-accent)]"
        />
      </label>

      {invisible && (
        <p className="m-0 rounded-xl bg-[rgb(255_165_61_/_0.1)] px-2.5 py-2 text-[13px] text-warn">
          Ten kolor prawie zlewa się z kartką. Zmień kolor pędzla albo tło.
        </p>
      )}
    </div>
  )
}
