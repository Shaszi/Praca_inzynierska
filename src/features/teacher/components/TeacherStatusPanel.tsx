type TeacherStatusPanelProps = {
  statusMessage: string
  errorMessage: string | null
  referencesCount: number
}

export function TeacherStatusPanel({
  statusMessage,
  errorMessage,
  referencesCount,
}: TeacherStatusPanelProps) {
  return (
    <section className="rounded-2xl border border-slate-300 bg-white p-4 text-sm text-slate-700 shadow-sm">
      <p className="font-medium text-slate-900">Teacher Status</p>
      <p className="mt-1">{statusMessage}</p>
      <p className="mt-2 text-slate-500">Saved references: {referencesCount}</p>
      {errorMessage ? <p className="mt-2 text-rose-600">{errorMessage}</p> : null}
    </section>
  )
}