import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../auth/authContext'
import { progressService, type PracticeSessionSummary, type Profile } from '../services/progressService'
import {
  addDays,
  computeGoalSummary,
  computeStreaks,
  todayIn,
  type DailyActivity,
  type GoalSummary,
  type Streaks,
} from '../utils/goalProgress'

const HISTORY_DAYS = 366
const RECENT_SESSIONS = 12

type UseProgressResult = {
  profile: Profile | null
  activity: DailyActivity[]
  recentSessions: PracticeSessionSummary[]
  today: string
  goal: GoalSummary | null
  streaks: Streaks
  totalCompleted: number
  isLoading: boolean
  error: string | null
  setGoal: (goalDays: number | null) => Promise<void>
  reload: () => void
}

export function useProgress(): UseProgressResult {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [activity, setActivity] = useState<DailyActivity[]>([])
  const [recentSessions, setRecentSessions] = useState<PracticeSessionSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const today = todayIn(profile?.timezone ?? 'Europe/Warsaw')

  useEffect(() => {
    if (!user) return
    let cancelled = false

    async function load(userId: string) {
      setIsLoading(true)
      try {
        const loadedProfile = await progressService.getProfile(userId)
        const since = addDays(todayIn(loadedProfile.timezone), -HISTORY_DAYS)
        const [loadedActivity, loadedSessions] = await Promise.all([
          progressService.getActivity(since),
          progressService.getRecentSessions(RECENT_SESSIONS),
        ])
        if (cancelled) return
        setProfile(loadedProfile)
        setActivity(loadedActivity)
        setRecentSessions(loadedSessions)
        setError(null)
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : String(loadError))
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load(user.id)
    return () => {
      cancelled = true
    }
  }, [user, reloadToken])

  const goal = useMemo(() => {
    if (!profile?.goalDays || !profile.goalStartedOn) return null
    return computeGoalSummary(activity, { goalDays: profile.goalDays, startedOn: profile.goalStartedOn }, today)
  }, [activity, profile, today])

  const streaks = useMemo(() => computeStreaks(activity, today), [activity, today])
  const totalCompleted = useMemo(
    () => activity.reduce((sum, entry) => sum + entry.completedCount, 0),
    [activity],
  )

  const setGoal = useCallback(
    async (goalDays: number | null) => {
      if (!user) return
      const updated = await progressService.setGoal(user.id, goalDays, goalDays ? today : null)
      setProfile(updated)
    },
    [today, user],
  )

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  return {
    profile,
    activity,
    recentSessions,
    today,
    goal,
    streaks,
    totalCompleted,
    isLoading,
    error,
    setGoal,
    reload,
  }
}
