type DebugPanelProps = {
  strokeCount: number
  currentStrokePointCount: number
  lastStrokeDurationMs: number | null
}

export function DebugPanel({
  strokeCount,
  currentStrokePointCount,
  lastStrokeDurationMs,
}: DebugPanelProps) {
  return (
    <section className="rounded-2xl border border-amber-300 bg-amber-50/80 p-4 text-sm text-amber-900">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">Debug</p>
      <div className="mt-2 grid gap-1 sm:grid-cols-3">
        <p>
          Strokes: <span className="font-semibold">{strokeCount}</span>
        </p>
        <p>
          Current stroke points:{' '}
          <span className="font-semibold">{currentStrokePointCount}</span>
        </p>
        <p>
          Last stroke duration:{' '}
          <span className="font-semibold">
            {lastStrokeDurationMs !== null ? `${lastStrokeDurationMs} ms` : 'N/A'}
          </span>
        </p>
      </div>
    </section>
  )
}