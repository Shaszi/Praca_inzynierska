import { useEffect, useState } from 'react'
import { Button, Spinner } from '../../../components/ui'
import { progressService, type PracticeSessionSummary } from '../services/progressService'
import { SessionGrid } from './SessionGrid'

const PAGE_SIZE = 12

export function SessionHistory() {
  const [page, setPage] = useState(0)
  const [result, setResult] = useState<{ page: number; sessions: PracticeSessionSummary[]; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    progressService
      .getSessionsPage(page, PAGE_SIZE)
      .then((loaded) => {
        if (cancelled) return
        // Usunięcie ostatniego rysunku na stronie: wracamy na poprzednią, zamiast pokazywać pustą.
        if (loaded.sessions.length === 0 && page > 0) {
          setPage(page - 1)
          return
        }
        setResult({ page, ...loaded })
        setError(null)
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : String(loadError))
      })
    return () => {
      cancelled = true
    }
  }, [page, reloadToken])

  if (error) return <p className="rounded-[16px] bg-danger-soft px-3.5 py-3 text-sm font-medium text-danger">{error}</p>
  if (!result) return <Spinner className="mx-auto h-6 w-6" />
  if (result.total === 0) {
    return (
      <p className="rounded-[22px] border border-dashed border-line-strong px-5 py-10 text-center text-sm text-ink-soft">
        Ukończ pierwsze ćwiczenie, a pojawi się tutaj.
      </p>
    )
  }

  const remove = async (session: PracticeSessionSummary) => {
    await progressService.deleteProject(session.id, session.photoPath)
    setReloadToken((token) => token + 1)
  }

  const pages = Math.ceil(result.total / PAGE_SIZE)
  const isLoading = result.page !== page

  return (
    <div className={`flex flex-col gap-4 ${isLoading ? 'opacity-60' : ''}`}>
      <SessionGrid key={result.page} sessions={result.sessions} onDelete={remove} />
      {pages > 1 && (
        <nav aria-label="Strony historii" className="flex items-center justify-center gap-3">
          <Button size="sm" disabled={page === 0 || isLoading} onClick={() => setPage(page - 1)}>
            Nowsze
          </Button>
          <span className="font-mono text-sm text-ink-soft" aria-live="polite">
            {page + 1} / {pages} · {result.total} rysunków
          </span>
          <Button size="sm" disabled={page >= pages - 1 || isLoading} onClick={() => setPage(page + 1)}>
            Starsze
          </Button>
        </nav>
      )}
    </div>
  )
}
