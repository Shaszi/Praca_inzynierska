import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Eyebrow, PageHeader, Panel, Segmented, Spinner } from '../components/ui'
import { useAuth } from '../features/auth/authContext'
import {
  matchesQuery,
  matchesRole,
  ROLE_LABELS,
  rolesService,
  type ManagedUserRow,
  type Role,
  type RoleFilter,
} from '../features/auth/rolesService'

type ManagedUser = ManagedUserRow

const ROLE_FILTERS: { value: RoleFilter; label: string }[] = [
  { value: 'all', label: 'Wszyscy' },
  { value: 'admin', label: 'Administratorzy' },
  { value: 'moderator', label: 'Moderatorzy' },
  { value: 'none', label: 'Bez roli' },
]


const ROLE_TONE: Record<Role, string> = {
  admin: 'bg-accent text-on-accent',
  moderator: 'bg-violet text-on-accent',
}

export function AdminPage() {
  const { user } = useAuth()
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')

  useEffect(() => {
    let cancelled = false
    rolesService.listUsersWithRoles().then((loaded) => {
      if (cancelled) return
      setUsers(loaded)
      setIsLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [reloadToken])

  const toggle = useCallback(
    async (target: ManagedUser, role: Role) => {
      if (!user) return
      setBusyId(target.id)
      const error = target.roles.includes(role)
        ? await rolesService.revokeRole(target.id, role)
        : await rolesService.grantRole(target.id, role, user.id)
      setBusyId(null)
      setMessage(error)
      setReloadToken((token) => token + 1)
    },
    [user],
  )

  const moderators = users.filter((entry) => entry.roles.length > 0).length

  // Filtrowanie po stronie klienta: lista profili jest już w pamięci, więc zapytanie
  // do bazy na każdą literę byłoby pracą bez zysku.
  const visible = useMemo(
    () => users.filter((entry) => matchesRole(entry, roleFilter) && matchesQuery(entry, query)),
    [query, roleFilter, users],
  )

  return (
    <div className="flex w-full flex-col gap-5 py-2 md:py-4">
      <PageHeader
        title="Panel administratora"
        description="Nadawaj i odbieraj role. Zmiana działa natychmiast, bez ponownego logowania."
      >
        <Link
          to="/app/moderation"
          className="inline-flex min-h-10 items-center rounded-full border-2 border-ink-faint px-4 text-sm font-bold text-ink transition hover:border-ink"
        >
          Kolejka moderacji
        </Link>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Panel className="px-5 py-4">
          <Eyebrow>Konta</Eyebrow>
          <p className="mt-2 font-mono text-[36px] leading-none font-medium tracking-[-0.03em]">{users.length}</p>
        </Panel>
        <Panel className="px-5 py-4">
          <Eyebrow>Z rolą</Eyebrow>
          <p className="mt-2 font-mono text-[36px] leading-none font-medium tracking-[-0.03em]">{moderators}</p>
        </Panel>
      </div>

      {message && <p className="rounded-[16px] bg-danger-soft px-3.5 py-3 text-sm font-medium text-danger">{message}</p>}

      <Panel className="p-[18px]">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Eyebrow as="h2">Użytkownicy</Eyebrow>
          <span className="font-mono text-[12.5px] text-ink-faint">
            {visible.length === users.length ? users.length : `${visible.length} z ${users.length}`}
          </span>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label className="relative min-w-[220px] flex-1">
            <span className="sr-only">Szukaj użytkownika</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Szukaj po nazwie lub id…"
              className="min-h-11 w-full rounded-full border border-ink-faint bg-surface px-4 text-[15px] text-ink transition placeholder:text-ink-faint focus:border-accent focus:outline-none"
            />
          </label>
          <Segmented
            options={ROLE_FILTERS}
            value={roleFilter}
            onChange={setRoleFilter}
            ariaLabel="Filtruj po roli"
          />
        </div>

        {isLoading ? (
          <Spinner className="m-auto h-6 w-6" />
        ) : (
          <ul className="m-0 flex list-none flex-col p-0">
            {visible.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-center gap-3 border-b border-line py-3 last:border-b-0"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-cyan text-sm font-bold text-on-accent">
                  {entry.displayName.slice(0, 1).toUpperCase()}
                </span>

                <span className="min-w-0 flex-1">
                  <b className="block truncate text-[15px] font-semibold">{entry.displayName}</b>
                  <span className="font-mono text-[12px] text-ink-faint">
                    {entry.id === user?.id ? 'to Ty' : entry.id.slice(0, 8)}
                  </span>
                </span>

                <span className="flex flex-wrap gap-1.5">
                  {entry.roles.map((role) => (
                    <span
                      key={role}
                      className={`inline-flex min-h-[30px] items-center rounded-full px-3 text-[12.5px] font-bold ${ROLE_TONE[role]}`}
                    >
                      {ROLE_LABELS[role]}
                    </span>
                  ))}
                </span>

                <span className="flex gap-1.5">
                  {(['moderator', 'admin'] as Role[]).map((role) => (
                    <Button
                      key={role}
                      size="sm"
                      variant={entry.roles.includes(role) ? 'danger' : 'ghost'}
                      disabled={busyId === entry.id}
                      onClick={() => void toggle(entry, role)}
                    >
                      {entry.roles.includes(role) ? `Odbierz ${ROLE_LABELS[role].toLowerCase()}` : ROLE_LABELS[role]}
                    </Button>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        )}

        {!isLoading && visible.length === 0 && (
          <p className="py-8 text-center text-sm text-ink-soft">
            Nikt nie pasuje do tych kryteriów.
          </p>
        )}

        <p className="mt-4 text-[13px] text-ink-faint">
          Lista pokazuje nazwy z profili, nie adresy e-mail — te zostają w tabeli uwierzytelniania,
          poza zasięgiem przeglądarki.
        </p>
      </Panel>
    </div>
  )
}
