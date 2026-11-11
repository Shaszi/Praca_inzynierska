import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader, Segmented } from '../components/ui'
import { useAuth } from '../features/auth/authContext'
import { ImportControl } from '../features/teacher/components/ImportExportControls'
import { LibraryGrid, type LibraryAction } from '../features/teacher/components/LibraryGrid'
import {
  referenceStorageService,
  type LibraryFilter,
} from '../features/teacher/services/referenceStorageService'
import { parseImportedReference } from '../features/teacher/utils/referenceValidation'
import type { ReferenceDrawing } from '../types/drawing'
import { supabase } from '../lib/supabase'

const EMPTY_TEXT: Record<LibraryFilter, string> = {
  mine: 'Nie masz jeszcze wzorców. Narysuj pierwszy w edytorze.',
  public: 'Nikt jeszcze nic nie opublikował. Możesz być pierwszy.',
  pending: 'Kolejka jest pusta — nic nie czeka na sprawdzenie.',
}

export function LibraryPage() {
  const { hasRole } = useAuth()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<LibraryFilter>('public')
  const [references, setReferences] = useState<ReferenceDrawing[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)

  const filters: { value: LibraryFilter; label: string }[] = [
    { value: 'public', label: 'Publiczne' },
    { value: 'mine', label: 'Moje' },
    ...(hasRole('moderator') ? [{ value: 'pending' as LibraryFilter, label: 'Do sprawdzenia' }] : []),
  ]

  const [reloadToken, setReloadToken] = useState(0)
  const refresh = useCallback(() => setReloadToken((token) => token + 1), [])

  useEffect(() => {
    let cancelled = false
    referenceStorageService.loadReferences(filter).then(({ data, error }) => {
      if (cancelled) return
      setReferences(data)
      setMessage(error)
      setIsLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [filter, reloadToken])

  const practise = useCallback((id: string) => navigate(`/app/practice?ref=${id}`), [navigate])

  const publish = useCallback(
    async (id: string) => {
      const { error } = await supabase.rpc('submit_reference_for_review', { p_reference_id: id })
      setMessage(error ? 'Nie udało się zgłosić wzorca.' : 'Wzorzec czeka na sprawdzenie przez moderatora.')
      refresh()
    },
    [refresh],
  )

  const remove = useCallback(
    async (id: string) => {
      const { error } = await referenceStorageService.deleteReference(id)
      setMessage(error ?? 'Wzorzec usunięty.')
      refresh()
    },
    [refresh],
  )

  /** Plik z dysku nie trafia do bazy — jedzie do ćwiczenia w stanie nawigacji. */
  const importLocal = useCallback(
    async (file: File) => {
      setIsImporting(true)
      try {
        const { data, error } = parseImportedReference(await file.text())
        if (!data) return void setMessage(error)
        navigate('/app/practice', { state: { localReference: data } })
      } catch {
        setMessage('Nie udało się odczytać pliku.')
      } finally {
        setIsImporting(false)
      }
    },
    [navigate],
  )

  const actions: LibraryAction[] = [
    { label: 'Ćwicz', onRun: practise, variant: 'primary' },
    {
      label: 'Opublikuj',
      onRun: publish,
      when: (reference) =>
        reference.isMine === true && (reference.publication === 'private' || reference.publication === 'rejected'),
    },
    { label: 'Usuń', onRun: remove, variant: 'danger', confirm: true, when: (reference) => reference.isMine === true },
  ]

  return (
    <div className="flex w-full flex-col gap-5 py-2 md:py-4">
      <PageHeader
        title="Biblioteka rysunków"
        description="Ćwicz na wzorcach innych osób albo zgłoś własny do wspólnej biblioteki."
      >
        <ImportControl onImport={importLocal} isImporting={isImporting} />
      </PageHeader>

      <div className="flex flex-wrap items-center gap-3">
        <Segmented options={filters} value={filter} onChange={setFilter} ariaLabel="Co pokazać" />
        {message && <p className="text-sm text-ink-soft">{message}</p>}
      </div>

      <LibraryGrid
        references={references}
        isLoading={isLoading}
        emptyText={EMPTY_TEXT[filter]}
        actions={actions}
      />
    </div>
  )
}
