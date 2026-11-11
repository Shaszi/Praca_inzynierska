import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '../components/ui'
import { LibraryGrid, type LibraryAction } from '../features/teacher/components/LibraryGrid'
import { referenceStorageService } from '../features/teacher/services/referenceStorageService'
import type { ReferenceDrawing } from '../types/drawing'

export function ModerationPage() {
  const [references, setReferences] = useState<ReferenceDrawing[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    referenceStorageService.loadReferences('pending').then(({ data, error }) => {
      if (cancelled) return
      setReferences(data)
      setMessage(error)
      setIsLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [reloadToken])

  const decide = useCallback(async (id: string, approved: boolean) => {
    const reason = approved
      ? undefined
      : // Powód trafia do autora, więc pytamy o niego zamiast odrzucać bez słowa.
        (window.prompt('Powód odrzucenia (zobaczy go autor):') ?? undefined)

    if (!approved && !reason) return

    const error = await referenceStorageService.moderate(id, approved, reason)
    setMessage(error ?? (approved ? 'Wzorzec opublikowany.' : 'Wzorzec odrzucony.'))
    setReloadToken((token) => token + 1)
  }, [])

  const actions: LibraryAction[] = [
    { label: 'Zatwierdź', onRun: (id) => decide(id, true), variant: 'primary' },
    { label: 'Odrzuć', onRun: (id) => decide(id, false), variant: 'danger' },
  ]

  return (
    <div className="flex w-full flex-col gap-5 py-2 md:py-4">
      <PageHeader
        title="Kolejka moderacji"
        description="Wzorce zgłoszone do wspólnej biblioteki. Rysunki renderują się tutaj z kresek — nie ma żadnych plików na serwerze."
      >
        <span className="inline-flex min-h-[34px] items-center rounded-full bg-warn-soft px-3.5 text-[13px] font-bold text-warn">
          {references.length} w kolejce
        </span>
      </PageHeader>

      {message && <p className="text-sm text-ink-soft">{message}</p>}

      <LibraryGrid
        references={references}
        isLoading={isLoading}
        emptyText="Kolejka jest pusta — nic nie czeka na sprawdzenie."
        actions={actions}
      />
    </div>
  )
}
