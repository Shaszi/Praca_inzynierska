type FeedbackPanelProps = {
  feedback: string
  similarity: number | null
}

export function FeedbackPanel({ feedback, similarity }: FeedbackPanelProps) {
  return (
    <section className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
        Feedback
      </p>
      <p className="mt-1 text-lg text-slate-900">{feedback}</p>
      {similarity !== null ? (
        <p className="mt-2 text-sm text-sky-700">
          Similarity score: {(similarity * 100).toFixed(1)}%
        </p>
      ) : null}
    </section>
  )
}
