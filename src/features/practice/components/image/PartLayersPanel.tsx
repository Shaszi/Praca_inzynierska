import type { Layer } from '../../../../types/drawing'
import type { PartView } from '../../parts/partLayers'

export function PartLayersPanel({
  layers,
  currentPartId,
  onChange,
}: {
  layers: Layer[]
  currentPartId: string | null
  onChange: (partId: string, view: PartView) => void
}) {
  return (
    <aside
      className="w-[290px] max-w-[88%] shrink-0 overflow-auto rounded-[18px] border border-line bg-surface p-3.5"
      aria-label="Warstwy części"
    >
      <h3 className="mb-2 text-[15px] font-semibold text-ink-faint">Warstwy</h3>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {layers.map((layer) => {
          const isCurrent = layer.id === currentPartId
          return (
            <li
              key={layer.id}
              className={`flex flex-col gap-1.5 rounded-[14px] border px-3 py-2 ${
                isCurrent ? 'border-accent bg-accent-soft/40' : 'border-line'
              }`}
            >
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-pressed={layer.visible}
                  aria-label={layer.visible ? `Ukryj: ${layer.name}` : `Pokaż: ${layer.name}`}
                  onClick={() => onChange(layer.id, { visible: !layer.visible, opacity: layer.opacity })}
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition ${
                    layer.visible ? 'bg-surface-dim text-ink' : 'text-ink-faint'
                  }`}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
                    {layer.visible ? <circle cx="12" cy="12" r="3" /> : <path d="M4 4l16 16" />}
                  </svg>
                </button>
                <span className="min-w-0 flex-1 truncate text-[14px] font-semibold" title={layer.name}>
                  {layer.name}
                </span>
                {isCurrent && <small className="shrink-0 text-[12px] font-bold text-accent">teraz</small>}
                <small className="shrink-0 font-mono text-[12px] text-ink-faint">{layer.strokes.length}</small>
              </div>
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={layer.opacity}
                aria-label={`Krycie: ${layer.name}`}
                onChange={(event) => onChange(layer.id, { visible: layer.visible, opacity: Number(event.target.value) })}
              />
            </li>
          )
        })}
      </ul>
    </aside>
  )
}
