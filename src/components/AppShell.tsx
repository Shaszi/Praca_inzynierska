import type { ComponentType, SVGProps } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../features/auth/authContext'
import { roleLabel, type Role } from '../features/auth/rolesService'
import { useProgress } from '../features/progress/hooks/useProgress'
import { BrandMark } from './BrandMark'
import { ChartIcon, HomeIcon, ImageIcon, LayersIcon, LogOutIcon, PencilIcon } from './icons'

type NavItem = {
  to: string
  label: string
  shortLabel: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  end?: boolean
}

// Etykiety i kolejność wprost z projektu.
const navItems: NavItem[] = [
  { to: '/app', label: 'Start', shortLabel: 'Start', icon: HomeIcon, end: true },
  { to: '/app/practice', label: 'Ćwicz', shortLabel: 'Ćwicz', icon: PencilIcon, end: true },
  { to: '/app/library', label: 'Biblioteka', shortLabel: 'Biblioteka', icon: LayersIcon },
  { to: '/app/references', label: 'Moje wzorce', shortLabel: 'Edytor', icon: PencilIcon },
  { to: '/app/practice/image', label: 'Ze zdjęcia', shortLabel: 'Zdjęcie', icon: ImageIcon },
  { to: '/app/progress', label: 'Postęp', shortLabel: 'Postęp', icon: ChartIcon },
]

function initials(label: string): string {
  const parts = label.trim().split(/[\s@._-]+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
}

function userLabel(user: ReturnType<typeof useAuth>['user']): string {
  const meta = user?.user_metadata as { display_name?: string; full_name?: string; name?: string } | undefined
  return meta?.display_name || meta?.full_name || meta?.name || user?.email || ''
}

export function AppShell() {
  const { user, signOut, roles, hasRole } = useAuth()

  // Trasy ról dokładamy do nawigacji dopiero, gdy rola jest znana.
  const items: NavItem[] = [
    ...navItems,
    ...(hasRole('moderator') ? [{ to: '/app/moderation', label: 'Moderacja', shortLabel: 'Moderacja', icon: ChartIcon }] : []),
    ...(hasRole('admin') ? [{ to: '/app/admin', label: 'Panel', shortLabel: 'Panel', icon: HomeIcon }] : []),
  ]
  const name = userLabel(user)

  return (
    <div className="flex min-h-screen flex-col text-ink">
      <header className="mx-auto flex w-full max-w-[1520px] flex-wrap items-center justify-between gap-4 px-4 py-4 md:px-6">
        <BrandMark />

        <nav
          className="hidden flex-wrap gap-1 md:flex"
          aria-label="Nawigacja główna"
        >
          {items.map(({ to, label, icon: ItemIcon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                [
                  'flex min-h-10 items-center gap-2 rounded-full px-3.5 text-sm font-semibold transition',
                  isActive ? 'bg-surface-dim text-ink' : 'text-ink-faint hover:text-ink',
                ].join(' ')
              }
            >
              <ItemIcon className="h-[18px] w-[18px]" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2.5">
          <StreakChip />
          <RoleBadge roles={roles} />
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-cyan text-sm font-bold text-on-accent"
            title={name}
            aria-hidden
          >
            {initials(name)}
          </span>
          <button
            type="button"
            onClick={signOut}
            className="flex min-h-11 items-center gap-2 rounded-full bg-surface-dim px-4 text-sm font-semibold text-ink-soft transition hover:bg-line-strong hover:text-ink"
          >
            <LogOutIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Wyloguj</span>
          </button>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 px-4 pb-24 md:px-6 md:pb-8">
        <div className="mx-auto flex min-h-0 w-full max-w-[1520px] flex-1">
          <Outlet />
        </div>
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-surface md:hidden"
        aria-label="Nawigacja główna"
      >
        {items.map(({ to, shortLabel, icon: ItemIcon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              [
                'flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition',
                isActive ? 'text-accent' : 'text-ink-faint',
              ].join(' ')
            }
          >
            <ItemIcon className="h-5 w-5" />
            {shortLabel}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

/**
 * Odznaka serii w pasku — w projekcie jest widoczna na każdym ekranie.
 *
 * shortcut: osobna instancja useProgress, więc na Starcie i Postępie dane lecą dwa razy.
 * Przenieść do wspólnego kontekstu albo cache zapytań, gdy dojdzie trzeci konsument.
 */
function StreakChip() {
  const { streaks, isLoading } = useProgress()
  if (isLoading || streaks.current === 0) return null

  return (
    <span className="inline-flex min-h-[34px] items-center gap-1.5 rounded-full bg-[rgb(255_154_61_/_0.14)] px-3.5 text-sm font-bold text-orange">
      <svg width="14" height="16" viewBox="0 0 14 16" aria-hidden>
        <path
          d="M7 0C8 4 13 6 13 10.5A6 6 0 0 1 1 10.5C1 8 3 7 4 5c.5 2 1.5 3 2.5 3C6 5 6 2 7 0z"
          fill="currentColor"
        />
      </svg>
      <span className="font-mono">{streaks.current}</span>
    </span>
  )
}

/**
 * Rola użytkownika w nagłówku. Administrator na cytrynowo, moderator na fioletowo,
 * zwykły użytkownik na spokojnie — kolor niesie hierarchię bez czytania napisu.
 */
function RoleBadge({ roles }: { roles: Role[] }) {
  const label = roleLabel(roles)
  const tone = roles.includes('admin')
    ? 'bg-accent text-on-accent'
    : roles.includes('moderator')
      ? 'bg-violet text-on-accent'
      : 'bg-surface-dim text-ink-faint'

  return (
    <span
      className={`hidden min-h-[34px] items-center rounded-full px-3.5 text-[13px] font-bold sm:inline-flex ${tone}`}
      title={`Twoja rola: ${label}`}
    >
      {label}
    </span>
  )
}
