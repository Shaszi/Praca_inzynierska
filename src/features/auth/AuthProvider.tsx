import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { AuthContext, type AuthContextValue } from './authContext'
import { hasRole as hasRoleIn, rolesService, type Role } from './rolesService'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Role trzymane razem z id właściciela. Dzięki temu po przelogowaniu nie da się
  // przez chwilę zobaczyć ról poprzedniego użytkownika, a stan „jeszcze nie wiem"
  // wynika z danych, nie z osobnej flagi.
  const [loadedRoles, setLoadedRoles] = useState<{ userId: string; roles: Role[] } | null>(null)

  useEffect(() => {
    // Flaga `cancelled` jest konieczna: w StrictMode efekt leci dwa razy, a późno
    // rozwiązany getSession() nadpisywałby świeższą sesję z onAuthStateChange.
    let cancelled = false

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (cancelled) return
        setSession(data.session)
        setIsLoading(false)
      })
      .catch(() => {
        // Bez tego bloku błąd sieci zostawiał isLoading na true na zawsze,
        // a strażnik tras pokazywał spinner bez końca i bez żadnego komunikatu.
        if (cancelled) return
        setError('Nie udało się sprawdzić sesji. Sprawdź połączenie i odśwież stronę.')
        setIsLoading(false)
      })

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (cancelled) return
      setSession(nextSession)
      setError(null)
      setIsLoading(false)
    })

    return () => {
      cancelled = true
      data.subscription.unsubscribe()
    }
  }, [])

  const userId = session?.user.id ?? null

  useEffect(() => {
    if (!userId) return

    let cancelled = false
    rolesService.loadRoles().then((loaded) => {
      if (cancelled) return
      setLoadedRoles({ userId, roles: loaded })
    })
    return () => {
      cancelled = true
    }
  }, [userId])

  const signOut = useCallback(async () => {
    const { error: signOutError } = await supabase.auth.signOut()
    if (signOutError) setError('Nie udało się wylogować. Spróbuj ponownie.')
  }, [])

  const roles = userId && loadedRoles?.userId === userId ? loadedRoles.roles : null

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      // Jedno isLoading obejmuje sesję i role, żeby strażnik tras nie przepuścił
      // użytkownika, zanim wiadomo, czy ma rolę.
      isLoading: isLoading || (userId !== null && roles === null),
      error,
      roles: roles ?? [],
      hasRole: (role: Role) => hasRoleIn(roles ?? [], role),
      signOut,
    }),
    [error, isLoading, roles, session, signOut, userId],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
