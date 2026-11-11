import { supabase } from '../../lib/supabase'

export type Role = 'moderator' | 'admin'

/** Nazwy po polsku do pokazania na stronie. */
export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrator',
  moderator: 'Moderator',
}

export const USER_LABEL = 'Użytkownik'

/**
 * Lustro warunku z SQL (`role in (target_role, 'admin')`): administrator spełnia
 * każdą rolę. Czysta funkcja, bo gatuje tylko nawigację — każdy zapis z uprawnieniami
 * jest i tak sprawdzany ponownie w bazie.
 */
export function hasRole(roles: Role[], role: Role): boolean {
  return roles.includes(role) || roles.includes('admin')
}

/** Najwyższa rola do wyświetlenia przy użytkowniku. */
export function roleLabel(roles: Role[]): string {
  if (roles.includes('admin')) return ROLE_LABELS.admin
  if (roles.includes('moderator')) return ROLE_LABELS.moderator
  return USER_LABEL
}

export type ManagedUserRow = { id: string; displayName: string; roles: Role[] }

export type RoleFilter = 'all' | Role | 'none'

/**
 * Filtr po roli jest DOKŁADNY, nie dziedziczący: „Moderatorzy" pokazuje konta z nadaną
 * rolą moderatora, a nie administratorów, którzy moderatorem są z definicji
 * (`hasRole` wyżej celowo dziedziczy — tam chodzi o uprawnienia, tu o to, co komu nadano).
 */
export function matchesRole(entry: ManagedUserRow, filter: RoleFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'none') return entry.roles.length === 0
  return entry.roles.includes(filter)
}

/** Szukanie po nazwie w dowolnym miejscu, po id tylko od początku — id nikt nie pamięta w środku. */
export function matchesQuery(entry: ManagedUserRow, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (needle === '') return true
  return entry.displayName.toLowerCase().includes(needle) || entry.id.toLowerCase().startsWith(needle)
}

export const rolesService = {
  /** Przy błędzie zwraca pustą listę — fail closed, brak uprawnień zamiast zgadywania. */
  async loadRoles(): Promise<Role[]> {
    const { data, error } = await supabase.from('user_roles').select('role')
    if (error || !data) return []
    return data
      .map((row) => row.role)
      .filter((role): role is Role => role === 'admin' || role === 'moderator')
  },

  async listUsersWithRoles(): Promise<ManagedUserRow[]> {
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase.from('profiles').select('id, display_name').order('created_at'),
      supabase.from('user_roles').select('user_id, role'),
    ])

    const byUser = new Map<string, Role[]>()
    for (const row of roles ?? []) {
      if (row.role !== 'admin' && row.role !== 'moderator') continue
      byUser.set(row.user_id, [...(byUser.get(row.user_id) ?? []), row.role])
    }

    return (profiles ?? []).map((profile) => ({
      id: profile.id,
      displayName: profile.display_name ?? '(bez nazwy)',
      roles: byUser.get(profile.id) ?? [],
    }))
  },

  /** `granted_by` musi być własnym id — tego wymaga polityka INSERT. */
  async grantRole(userId: string, role: Role, grantedBy: string): Promise<string | null> {
    const { error } = await supabase.from('user_roles').insert({ user_id: userId, role, granted_by: grantedBy })
    return error ? 'Nie udało się nadać roli. Tylko administrator może to zrobić.' : null
  },

  async revokeRole(userId: string, role: Role): Promise<string | null> {
    const { data, error } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .eq('role', role)
      .select('role')

    if (error) return 'Nie udało się odebrać roli.'
    if (!data || data.length === 0) return 'Nie masz uprawnień, żeby odebrać tę rolę.'
    return null
  },
}
