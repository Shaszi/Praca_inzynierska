type FeedbackPanelProps = {
  feedback: string | null
  similarity: number | null
  isLoading?: boolean
  canProceed?: boolean
  canRetry?: boolean
  isLastStroke?: boolean
  onNextStroke?: () => void
  onRetry?: () => void
}

function SimilarityBar({ value }: { value: number }) {
  const percent = Math.round(value * 100)
  const color =
    percent >= 75 ? 'bg-emerald-500' : percent >= 55 ? 'bg-amber-400' : 'bg-rose-500'

  return (
    <div className="mt-3">
      <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
        <span>Podobieństwo geometryczne</span>
        <span className="font-semibold text-slate-700">{percent}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

function LoadingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="h-2 w-2 animate-bounce rounded-full bg-sky-500 [animation-delay:0ms]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-sky-500 [animation-delay:150ms]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-sky-500 [animation-delay:300ms]" />
    </span>
  )
}

export function FeedbackPanel({
  feedback,
  similarity,
  isLoading = false,
  canProceed = false,
  canRetry = false,
  isLastStroke = false,
  onNextStroke,
  onRetry,
}: FeedbackPanelProps) {
  return (
    <section className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
            Analiza AI
          </p>

          {isLoading ? (
            <div className="mt-2 flex items-center gap-3 text-slate-500">
              <LoadingDots />
              <span className="text-sm">Analizuję kreskę...</span>
            </div>
          ) : feedback ? (
            <p className="mt-1 text-base leading-relaxed text-slate-800">{feedback}</p>
          ) : (
            <p className="mt-1 text-base text-slate-400">
              Narysuj kreskę, aby uzyskać analizę AI.
            </p>
          )}

          {similarity !== null && <SimilarityBar value={similarity} />}
        </div>

        {(canProceed || canRetry) && (
          <div className="flex shrink-0 flex-col gap-2">
            {canRetry && onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-100 active:scale-95"
              >
                Spróbuj jeszcze raz
              </button>
            )}
            {canProceed && onNextStroke && (
              <button
                type="button"
                onClick={onNextStroke}
                className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-600 active:scale-95"
              >
                {isLastStroke ? 'Zakończ ćwiczenie' : 'Następna kreska →'}
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
