import { describe, expect, it } from 'vitest'
import { hasRole, matchesQuery, matchesRole, roleLabel, type ManagedUserRow } from './rolesService'

const u = (displayName: string, roles: ManagedUserRow['roles'], id = 'aaaabbbb-1111'): ManagedUserRow => ({
  id,
  displayName,
  roles,
})

describe('hasRole', () => {
  // Lustro warunku z SQL: `role in (target_role, 'admin')`.
  it('administrator spełnia każdą rolę', () => {
    expect(hasRole(['admin'], 'moderator')).toBe(true)
    expect(hasRole(['admin'], 'admin')).toBe(true)
  })

  it('moderator nie jest administratorem', () => {
    expect(hasRole(['moderator'], 'admin')).toBe(false)
    expect(hasRole(['moderator'], 'moderator')).toBe(true)
  })

  it('brak roli nie daje nic', () => {
    expect(hasRole([], 'moderator')).toBe(false)
    expect(hasRole([], 'admin')).toBe(false)
  })
})

describe('roleLabel', () => {
  it('pokazuje najwyższą rolę', () => {
    expect(roleLabel(['admin', 'moderator'])).toBe('Administrator')
    expect(roleLabel(['moderator'])).toBe('Moderator')
    expect(roleLabel([])).toBe('Użytkownik')
  })
})

describe('matchesRole', () => {
  // To jest ta nieoczywista decyzja: filtr listy jest DOKŁADNY, a nie dziedziczący.
  // Administrator jest moderatorem w sensie uprawnień, ale na liście zarządzania
  // chcesz widzieć, co komu faktycznie nadano.
  it('administrator NIE wpada do filtra moderatorów', () => {
    expect(matchesRole(u('Ala', ['admin']), 'moderator')).toBe(false)
    expect(matchesRole(u('Ala', ['admin']), 'admin')).toBe(true)
  })

  it('konto z obiema rolami wpada do obu filtrów', () => {
    const both = u('Ola', ['admin', 'moderator'])
    expect(matchesRole(both, 'admin')).toBe(true)
    expect(matchesRole(both, 'moderator')).toBe(true)
  })

  it('bez roli wpada tylko do „bez roli"', () => {
    const plain = u('Jan', [])
    expect(matchesRole(plain, 'none')).toBe(true)
    expect(matchesRole(plain, 'moderator')).toBe(false)
    expect(matchesRole(u('Ala', ['admin']), 'none')).toBe(false)
  })

  it('„wszyscy" przepuszcza każdego', () => {
    expect(matchesRole(u('Jan', []), 'all')).toBe(true)
    expect(matchesRole(u('Ala', ['admin']), 'all')).toBe(true)
  })
})

describe('matchesQuery', () => {
  const entry = u('Kamil Rysownik', [], 'deadbeef-1234')

  it('puste zapytanie przepuszcza wszystko', () => {
    expect(matchesQuery(entry, '')).toBe(true)
    expect(matchesQuery(entry, '   ')).toBe(true)
  })

  it('nazwę dopasowuje w dowolnym miejscu i bez względu na wielkość liter', () => {
    expect(matchesQuery(entry, 'kamil')).toBe(true)
    expect(matchesQuery(entry, 'RYSOW')).toBe(true)
    expect(matchesQuery(entry, ' rysownik ')).toBe(true)
    expect(matchesQuery(entry, 'zenek')).toBe(false)
  })

  it('id dopasowuje tylko od początku', () => {
    expect(matchesQuery(entry, 'deadbeef')).toBe(true)
    expect(matchesQuery(entry, 'DEAD')).toBe(true)
    expect(matchesQuery(entry, 'beef')).toBe(false)
  })
})
