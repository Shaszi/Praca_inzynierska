import { useState, type FormEvent } from 'react'

const PRESETS = [7, 14, 30, 60, 100]

type GoalSetupProps = {
  initialDays?: number
  onSave: (days: number) => Promise<void>
  onCancel?: () => void
  onClear?: () => Promise<void>
}

export function GoalSetup({ initialDays = 30, onSave, onCancel, onClear }: GoalSetupProps) {
  const [days, setDays] = useState(initialDays)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (action: () => Promise<void>) => {
    setIsSaving(true)
    setError(null)
    try {
      await action()
    } catch {
      setError('Nie udało się zapisać celu.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    run(() => onSave(days))
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-[22px] border border-line bg-surface p-[18px] sm:p-6">
      <p className="text-[22px] font-bold tracking-[-0.01em] text-ink">Ile dni chcesz ćwiczyć?</p>
      <p className="mt-1 max-w-xl text-ink-faint">
        Dzień liczy się, gdy ukończysz w nim co najmniej jeden rysunek. Postęp liczony jest od dziś.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => setDays(preset)}
            className={[
              'min-h-11 rounded-full border px-4 font-mono text-sm font-medium transition',
              days === preset
                ? 'border-accent bg-accent text-on-accent'
                : 'border-ink-faint bg-surface text-ink-soft hover:bg-surface-dim',
            ].join(' ')}
          >
            {preset} dni
          </button>
        ))}
      </div>

      <div className="mt-5 flex items-center gap-4">
        <input
          type="range"
          min={1}
          max={365}
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="w-full max-w-md accent-[var(--color-accent)]"
          aria-label="Liczba dni"
        />
        <input
          type="number"
          min={1}
          max={365}
          value={days}
          onChange={(e) => setDays(Math.min(365, Math.max(1, Number(e.target.value) || 1)))}
          className="min-h-11 w-24 rounded-full border border-ink-faint bg-surface px-2 text-center font-mono focus:border-accent focus:outline-none"
          aria-label="Liczba dni (pole liczbowe)"
        />
      </div>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isSaving}
          className="min-h-11 rounded-full bg-accent px-4 text-[15px] font-semibold text-on-accent transition hover:bg-accent-strong disabled:opacity-60"
        >
          Ustaw cel: {days} dni
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="min-h-11 rounded-full border border-ink-faint bg-surface px-4 text-[15px] font-semibold text-ink hover:bg-surface-dim">
            Anuluj
          </button>
        )}
        {onClear && (
          <button
            type="button"
            disabled={isSaving}
            onClick={() => run(onClear)}
            className="ml-auto min-h-11 rounded-full px-3 text-sm font-semibold text-ink-faint hover:bg-danger-soft hover:text-danger"
          >
            Usuń cel
          </button>
        )}
      </div>
    </form>
  )
}
