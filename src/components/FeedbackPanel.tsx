type FeedbackPanelProps = {
  feedback: string
  similarity: number | null
}

export function FeedbackPanel({ feedback, similarity }: FeedbackPanelProps) {
  return (
    <section className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4">
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-400">
        Feedback
      </p>
      <p className="mt-1 text-lg text-slate-100">{feedback}</p>
      {similarity !== null ? (
        <p className="mt-2 text-sm text-cyan-200">
          Similarity score: {(similarity * 100).toFixed(1)}%
        </p>
      ) : null}
    </section>
  )
}