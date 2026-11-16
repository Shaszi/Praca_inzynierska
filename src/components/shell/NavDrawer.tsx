import { useEffect, useRef } from 'react'
import { NavLink } from 'react-router-dom'
import type { Role } from '../../features/auth/rolesService'
import { LogOutIcon } from '../icons'
import { RoleBadge, UserAvatar } from './HeaderBadges'
import type { NavItem } from './navItems'

/**
 * Wysuwane menu z prawej — na tablecie i telefonie zamiast paska, który się zawijał.
 * Duże wiersze (56 px) pod palec. Esc, klik w tło i wybór pozycji zamykają menu;
 * fokus wchodzi na „Zamknij", a strona pod spodem się nie przewija.
 */
export function NavDrawer({
  id,
  isOpen,
  onClose,
  items,
  name,
  email,
  roles,
  onSignOut,
}: {
  id: string
  isOpen: boolean
  onClose: () => void
  items: NavItem[]
  name: string
  email: string
  roles: Role[]
  onSignOut: () => void
}) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!isOpen) return
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const previousOverflow = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.documentElement.style.overflow = previousOverflow
    }
  }, [isOpen, onClose])

  return (
    <div
      className={`fixed inset-0 z-[90] transition ${isOpen ? 'visible' : 'invisible'}`}
      aria-hidden={!isOpen}
    >
      <div
        className={`absolute inset-0 bg-[rgb(13_11_32_/_0.6)] backdrop-blur-[2px] transition-opacity duration-200 ${
          isOpen ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />
      <aside
        id={id}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className={`absolute top-0 right-0 bottom-0 flex w-[340px] max-w-[88vw] flex-col gap-4 overflow-y-auto border-l border-line bg-surface p-5 shadow-[var(--shadow-float)] transition-transform duration-200 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center gap-3">
          <UserAvatar name={name} size="h-12 w-12 text-base" />
          <div className="min-w-0 flex-1">
            <b className="block truncate font-display text-[17px]">{name}</b>
            {email && email !== name && <small className="block truncate text-[13px] text-ink-faint">{email}</small>}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Zamknij menu"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface-dim text-ink-soft transition hover:text-ink"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div>
          <RoleBadge roles={roles} />
        </div>

        <nav className="flex flex-col gap-1" aria-label="Nawigacja główna">
          {items.map(({ to, label, icon: ItemIcon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onClose}
              className={({ isActive }) =>
                [
                  'flex min-h-14 items-center gap-3.5 rounded-[16px] px-4 text-[16px] font-semibold transition',
                  isActive ? 'bg-accent-soft/50 text-ink' : 'text-ink-soft hover:bg-surface-dim hover:text-ink',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  <ItemIcon className={`h-[22px] w-[22px] ${isActive ? 'text-accent' : ''}`} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <button
          type="button"
          onClick={() => {
            onClose()
            onSignOut()
          }}
          className="mt-auto flex min-h-14 items-center gap-3.5 rounded-[16px] bg-surface-dim px-4 text-[16px] font-semibold text-ink-soft transition hover:bg-line-strong hover:text-ink"
        >
          <LogOutIcon className="h-[22px] w-[22px]" />
          Wyloguj
        </button>
      </aside>
    </div>
  )
}
