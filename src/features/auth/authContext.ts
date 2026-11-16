import { createContext, useContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import type { Role } from './rolesService'

export type AuthContextValue = {
  session: Session | null
  user: User | null
  isLoading: boolean
  error: string | null
  roles: Role[]
  hasRole: (role: Role) => boolean
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth musi być użyty wewnątrz <AuthProvider>')
  return context
}
