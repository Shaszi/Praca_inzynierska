import type { ComponentType, SVGProps } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../features/auth/authContext'
import { BrandMark } from './BrandMark'
import { ChartIcon, HomeIcon, ImageIcon, LayersIcon, LogOutIcon, PencilIcon } from './icons'

type NavItem = {
  to: string
  label: string
  shortLabel: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  end?: boolean
}

const navItems: NavItem[] = [
  { to: '/app', label: 'Pulpit', shortLabel: 'Pulpit', icon: HomeIcon, end: true },
  { to: '/app/practice', label: 'Ćwiczenia z wzorcem', shortLabel: 'Wzorzec', icon: PencilIcon, end: true },
  { to: '/app/practice/image', label: 'Rysuj ze zdjęcia', shortLabel: 'Zdjęcie', icon: ImageIcon },
  { to: '/app/references', label: 'Moje wzorce', shortLabel: 'Wzorce', icon: LayersIcon },
  { to: '/app/progress', label: 'Postęp', shortLabel: 'Postęp', icon: ChartIcon },
]

function userLabel(user: ReturnType<typeof useAuth>['user']): string {
  const meta = user?.user_metadata as { display_name?: string; full_name?: string; name?: string } | undefined
  return meta?.display_name || meta?.full_name || meta?.name || user?.email || ''
}

export function AppShell() {
  const { user, signOut } = useAuth()
  const name = userLabel(user)

  return (
    <div className="flex min-h-screen flex-col text-ink">
      <header className="mx-auto flex w-full max-w-[1520px] flex-wrap items-center justify-between gap-4 px-4 py-4 md:px-6">
        <BrandMark />

        <nav
          className="hidden flex-wrap gap-1 rounded-xl border border-line bg-surface p-1 md:flex"
          aria-label="Nawigacja główna"
        >
          {navItems.map(({ to, label, icon: ItemIcon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                [
                  'flex min-h-11 items-center gap-2 rounded-[9px] px-4 text-[15px] font-medium transition',
                  isActive ? 'bg-ink text-white' : 'text-ink-soft hover:bg-surface-dim',
                ].join(' ')
              }
            >
              <ItemIcon className="h-[18px] w-[18px]" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <span className="hidden max-w-40 truncate text-sm text-ink-faint lg:block" title={name}>
            {name}
          </span>
          <button
            type="button"
            onClick={signOut}
            className="flex min-h-11 items-center gap-2 rounded-[10px] border border-line-strong bg-surface px-3 text-sm font-semibold text-ink transition hover:bg-surface-dim"
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
        {navItems.map(({ to, shortLabel, icon: ItemIcon, end }) => (
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
