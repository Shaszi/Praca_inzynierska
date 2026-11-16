import { useCallback, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../features/auth/authContext'
import { BrandMark } from './BrandMark'
import { LogOutIcon } from './icons'
import { RoleBadge, StreakChip, UserAvatar } from './shell/HeaderBadges'
import { userLabel } from './shell/userLabel'
import { NavDrawer } from './shell/NavDrawer'
import { navItemsFor } from './shell/navItems'

const DRAWER_ID = 'app-nav-drawer'

export function AppShell() {
  const { user, signOut, roles, hasRole } = useAuth()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const closeMenu = useCallback(() => setIsMenuOpen(false), [])
  const items = navItemsFor(hasRole)
  const name = userLabel(user)

  return (
    <div className="flex min-h-screen flex-col text-ink">
      <header className="mx-auto flex w-full max-w-[1520px] items-center justify-between gap-4 px-4 py-4 md:px-6">
        <BrandMark />

        <nav className="hidden gap-1 xl:flex" aria-label="Nawigacja główna">
          {items.map(({ to, label, icon: ItemIcon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                [
                  'flex min-h-10 items-center gap-2 rounded-full px-3.5 text-sm font-semibold whitespace-nowrap transition',
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
          <span className="hidden xl:contents">
            <RoleBadge roles={roles} />
            <UserAvatar name={name} />
            <button
              type="button"
              onClick={signOut}
              className="flex min-h-11 items-center gap-2 rounded-full bg-surface-dim px-4 text-sm font-semibold text-ink-soft transition hover:bg-line-strong hover:text-ink"
            >
              <LogOutIcon className="h-4 w-4" />
              Wyloguj
            </button>
          </span>
          <button
            type="button"
            onClick={() => setIsMenuOpen(true)}
            aria-expanded={isMenuOpen}
            aria-controls={DRAWER_ID}
            className="flex min-h-11 items-center gap-2 rounded-full bg-surface-dim px-4 text-sm font-semibold text-ink transition hover:bg-line-strong xl:hidden"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
            Menu
          </button>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 px-4 pb-8 md:px-6">
        <div className="mx-auto flex min-h-0 w-full max-w-[1520px] flex-1">
          <Outlet />
        </div>
      </main>

      <NavDrawer
        id={DRAWER_ID}
        isOpen={isMenuOpen}
        onClose={closeMenu}
        items={items}
        name={name}
        email={user?.email ?? ''}
        roles={roles}
        onSignOut={signOut}
      />
    </div>
  )
}
