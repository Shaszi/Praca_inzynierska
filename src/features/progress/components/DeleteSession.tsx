import { useState } from 'react'
import { Button } from '../../../components/ui'

export function DeleteSession({ onDelete }: { onDelete: () => Promise<void> }) {
  const [isConfirming, setIsConfirming] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const remove = async () => {
    setIsDeleting(true)
    setError(null)
    try {
      await onDelete()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się usunąć rysunku.')
      setIsDeleting(false)
    }
  }

  if (!isConfirming) {
    return (
      <Button variant="danger" size="sm" onClick={() => setIsConfirming(true)}>
        Usuń
      </Button>
    )
  }

  return (
    <div className="flex flex-col gap-2" role="group" aria-label="Potwierdź usunięcie">
      <p className="text-[13px] text-ink-soft">Usunąć rysunek z historii razem z ocenami kresek? Tego nie da się cofnąć.</p>
      <div className="flex gap-2">
        <Button variant="danger" size="sm" className="flex-1" disabled={isDeleting} onClick={remove}>
          {isDeleting ? 'Usuwam…' : 'Usuń'}
        </Button>
        <Button variant="ghost" size="sm" disabled={isDeleting} onClick={() => setIsConfirming(false)}>
          Anuluj
        </Button>
      </div>
      {error && (
        <small role="alert" className="text-[12.5px] text-danger">
          {error}
        </small>
      )}
    </div>
  )
}
