import type { useAuth } from '../../features/auth/authContext'

export function userLabel(user: ReturnType<typeof useAuth>['user']): string {
  const meta = user?.user_metadata as { display_name?: string; full_name?: string; name?: string } | undefined
  return meta?.display_name || meta?.full_name || meta?.name || user?.email || ''
}
