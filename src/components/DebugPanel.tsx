type DebugPanelProps = {
  strokeCount: number
  currentStrokePointCount: number
  lastStrokeDurationMs: number | null
}

// Dane techniczne płótna — zwinięte domyślnie, żeby nie zaśmiecały interfejsu.
export function DebugPanel({ strokeCount, currentStrokePointCount, lastStrokeDurationMs }: DebugPanelProps) {
  return (
    <details className="group text-[13px] text-ink-faint">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 select-none hover:text-ink-soft">
        <span className="transition group-open:rotate-90">›</span> Dane techniczne
      </summary>
      <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 tabular-nums">
        <div className="flex gap-1.5">
          <dt>Kreski:</dt>
          <dd className="text-ink-soft">{strokeCount}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt>Punkty bieżącej kreski:</dt>
          <dd className="text-ink-soft">{currentStrokePointCount}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt>Czas ostatniej kreski:</dt>
          <dd className="text-ink-soft">{lastStrokeDurationMs !== null ? `${lastStrokeDurationMs} ms` : '—'}</dd>
        </div>
      </dl>
    </details>
  )
}
