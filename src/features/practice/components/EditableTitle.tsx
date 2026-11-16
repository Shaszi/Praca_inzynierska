import { useState } from 'react'
import { Button } from '../../../components/ui'

function PencilIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 20h4L19 9l-4-4L4 16z" />
      <path d="M13.5 6.5l4 4" />
    </svg>
  )
}

export function EditableTitle({
  title,
  onRename,
  className = 'text-[14.5px]',
}: {
  title: string
  onRename: (title: string) => Promise<void>
  className?: string
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const close = () => {
    setDraft(null)
    setError(null)
  }

  if (draft === null) {
    return (
      <span className="flex min-w-0 items-center gap-1">
        <b className={`min-w-0 truncate ${className}`} title={title}>{title}</b>
        <button
          type="button"
          aria-label="Zmień nazwę"
          title="Zmień nazwę"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-faint transition hover:bg-surface-dim hover:text-ink"
          onClick={() => setDraft(title)}
        >
          <PencilIcon />
        </button>
      </span>
    )
  }

  const save = async () => {
    if (draft.trim() === title) return close()
    setIsSaving(true)
    try {
      await onRename(draft)
      close()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zmienić nazwy.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form
      className="flex min-w-0 flex-col gap-1"
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
    >
      <span className="flex items-center gap-1">
        <input
          autoFocus
          aria-label="Nazwa projektu"
          maxLength={200}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => event.key === 'Escape' && close()}
          className="min-h-9 w-full min-w-0 rounded-full border border-ink-faint bg-surface px-3 text-[14.5px] text-ink focus:border-accent focus:outline-none"
        />
        <Button type="submit" size="sm" variant="primary" disabled={isSaving}>Zapisz</Button>
        <Button size="sm" variant="ghost" onClick={close}>Anuluj</Button>
      </span>
      {error && <small role="alert" className="text-[12.5px] text-danger">{error}</small>}
    </form>
  )
}
