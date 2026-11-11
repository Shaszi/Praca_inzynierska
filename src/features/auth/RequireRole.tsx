import { Link, Outlet } from 'react-router-dom'
import { Spinner } from '../../components/ui'
import { useAuth } from './authContext'
import { ROLE_LABELS, type Role } from './rolesService'

/**
 * Strażnik tras dla ról. Zalogowanego bez uprawnień NIE wysyła na logowanie —
 * to byłaby ślepa uliczka, bo ponowne logowanie nic nie zmieni. Pokazuje komunikat.
 *
 * Gatuje wyłącznie nawigację. Każdy zapis z uprawnieniami jest sprawdzany ponownie
 * w bazie (`has_role` w politykach i w ciele funkcji), więc nieaktualna rola
 * w przeglądarce nic nie daje.
 */
export function RequireRole({ role }: { role: Role }) {
  const { isLoading, hasRole } = useAuth()

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner className="h-6 w-6" />
      </div>
    )
  }

  if (!hasRole(role)) {
    return (
      <div className="m-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
        <p className="font-display text-[22px] font-bold">Ta strona jest dla roli: {ROLE_LABELS[role]}</p>
        <p className="text-ink-soft">
          Twoje konto nie ma tych uprawnień. Jeśli uważasz, że powinno — poproś administratora.
        </p>
        <Link
          to="/app"
          className="mt-2 inline-flex min-h-12 items-center rounded-full bg-accent px-[22px] font-bold text-on-accent transition hover:bg-accent-strong"
        >
          Wróć na start
        </Link>
      </div>
    )
  }

  return <Outlet />
}
