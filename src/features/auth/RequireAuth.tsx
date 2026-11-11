import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Spinner } from '../../components/ui'
import { useAuth } from './authContext'

export function RequireAuth() {
  const { user, isLoading, error } = useAuth()
  const location = useLocation()

  // Błąd sprawdzania sesji dostaje własny ekran. Wcześniej taki przypadek kończył się
  // spinnerem bez końca, bo isLoading nigdy nie schodziło.
  if (error && !user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="font-display text-[20px] font-bold">Nie udało się sprawdzić sesji</p>
        <p className="max-w-sm text-ink-soft">{error}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex min-h-12 items-center rounded-full bg-accent px-[22px] font-bold text-on-accent transition hover:bg-accent-strong"
        >
          Odśwież stronę
        </button>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-6 w-6" />
      </div>
    )
  }

  if (!user) {
    // Pełna lokalizacja, nie tylko pathname — inaczej parametry docelowej strony giną.
    const from = `${location.pathname}${location.search}${location.hash}`
    return <Navigate to="/login" replace state={{ from }} />
  }

  return <Outlet />
}
