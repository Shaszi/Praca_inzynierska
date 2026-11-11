import { rangeClass, Segmented } from '../../../components/ui'
import type { SmoothingMode, SmoothingSettings } from '../../../types/drawing'

type SmoothingControlProps = {
  value: SmoothingSettings
  onChange: (value: SmoothingSettings) => void
  layout?: 'inline' | 'stacked'
}

const MODE_OPTIONS: { value: SmoothingMode; label: string; title: string }[] = [
  { value: 'off', label: 'Brak', title: 'Surowy ruch ręki, bez wygładzania' },
  { value: 'adaptive', label: 'Płynne', title: 'Filtr adaptacyjny (One Euro) — usuwa drżenie, mało opóźnienia' },
  { value: 'rope', label: 'Linka', title: 'Stabilizator „linki” — pędzel podąża za kursorem na sznurku, bardzo czyste linie' },
]

export function SmoothingControl({ value, onChange, layout = 'inline' }: SmoothingControlProps) {
  const stacked = layout === 'stacked'

  return (
    <div className={stacked ? 'grid gap-2' : 'flex flex-wrap items-center gap-2'}>
      <span className="text-[13px] text-ink-soft">Wygładzanie</span>

      <Segmented
        options={MODE_OPTIONS}
        value={value.mode}
        onChange={(mode) => onChange({ ...value, mode })}
        ariaLabel="Tryb wygładzania"
      />

      <label className={`flex items-center gap-2 transition ${value.mode === 'off' ? 'opacity-40' : ''}`}>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={value.strength}
          disabled={value.mode === 'off'}
          onChange={(event) => onChange({ ...value, strength: Number(event.target.value) })}
          className={`${stacked ? 'w-full' : 'w-20'} ${rangeClass}`}
          aria-label="Siła wygładzania"
        />
        <span className="w-7 text-right text-xs tabular-nums text-ink-soft">{value.strength}</span>
      </label>
    </div>
  )
}
