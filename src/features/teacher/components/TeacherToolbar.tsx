type TeacherToolbarProps = {
  onSave: () => void
  onLoad: () => void
  onDelete: () => void
  isSaving: boolean
}

export function TeacherToolbar({ onSave, onLoad, onDelete, isSaving }: TeacherToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={onSave}
        disabled={isSaving}
        className="rounded-lg border border-sky-300 bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-700 transition hover:border-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSaving ? 'Saving...' : 'Save Reference'}
      </button>
      <button
        type="button"
        onClick={onLoad}
        className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400"
      >
        Load
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400"
      >
        Delete
      </button>
    </div>
  )
}