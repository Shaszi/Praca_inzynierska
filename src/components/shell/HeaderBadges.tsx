import { roleLabel, type Role } from '../../features/auth/rolesService'
import { useProgress } from '../../features/progress/hooks/useProgress'

function initials(label: string): string {
  const parts = label.trim().split(/[\s@._-]+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
}

/** Kółko z inicjałami użytkownika. */
export function UserAvatar({ name, size = 'h-9 w-9 text-sm' }: { name: string; size?: string }) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full bg-cyan font-bold text-on-accent ${size}`}
      title={name}
      aria-hidden
    >
      {initials(name)}
    </span>
  )
}

/**
 * Odznaka serii w pasku — w projekcie jest widoczna na każdym ekranie.
 *
 * shortcut: osobna instancja useProgress, więc na Starcie i Postępie dane lecą dwa razy.
 * Przenieść do wspólnego kontekstu albo cache zapytań, gdy dojdzie trzeci konsument.
 */
export function StreakChip() {
  const { streaks, isLoading } = useProgress()
  if (isLoading || streaks.current === 0) return null

  return (
    <span
      className="inline-flex min-h-[34px] items-center gap-1.5 rounded-full bg-[rgb(255_154_61_/_0.14)] px-3.5 text-sm font-bold text-orange"
      title={`Seria: ${streaks.current}`}
    >
      <svg width="14" height="16" viewBox="0 0 14 16" aria-hidden>
        <path d="M7 0C8 4 13 6 13 10.5A6 6 0 0 1 1 10.5C1 8 3 7 4 5c.5 2 1.5 3 2.5 3C6 5 6 2 7 0z" fill="currentColor" />
      </svg>
      <span className="font-mono">{streaks.current}</span>
    </span>
  )
}

/**
 * Rola użytkownika. Administrator na cytrynowo, moderator na fioletowo,
 * zwykły użytkownik na spokojnie — kolor niesie hierarchię bez czytania napisu.
 */
export function RoleBadge({ roles }: { roles: Role[] }) {
  const label = roleLabel(roles)
  const tone = roles.includes('admin')
    ? 'bg-accent text-on-accent'
    : roles.includes('moderator')
      ? 'bg-violet text-on-accent'
      : 'bg-surface-dim text-ink-faint'

  return (
    <span className={`inline-flex min-h-[30px] items-center rounded-full px-3 text-[13px] font-bold ${tone}`} title={`Twoja rola: ${label}`}>
      {label}
    </span>
  )
}
