import { Spinner } from '../components/ui'
import { DailyChallengeCard } from '../features/progress/components/dashboard/DailyChallengeCard'
import { BadgesCard, ContinueCard, GoalCard, WarmupCard } from '../features/progress/components/dashboard/SmallCards'
import { StreakCard } from '../features/progress/components/dashboard/StreakCard'
import { useProgress } from '../features/progress/hooks/useProgress'
import { challengeForDay } from '../features/progress/utils/dailyChallenge'
import { badgeStates, hoursLeftToday, nextMilestone, weekStrip } from '../features/progress/utils/streakRewards'

export function DashboardPage() {
  const { profile, goal, streaks, activity, today, recentSessions, isLoading, error } = useProgress()

  if (isLoading && !profile) {
    return <Spinner className="m-auto h-6 w-6" />
  }

  const streak = streaks.current
  const isTodayDone = goal?.isTodayDone ?? activity.some((e) => e.day === today && e.completedCount > 0)

  return (
    <div className="flex w-full flex-col gap-4 py-2 md:py-4">
      {error && <p className="rounded-[16px] bg-danger-soft px-3.5 py-3 text-sm font-medium text-danger">{error}</p>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <StreakCard
          streak={streak}
          isTodayDone={isTodayDone}
          hoursLeft={hoursLeftToday()}
          week={weekStrip(activity, today)}
          milestone={nextMilestone(streak)}
        />
        <DailyChallengeCard challenge={challengeForDay(today)} />
        <GoalCard goal={goal} />
        <ContinueCard session={recentSessions[0] ?? null} />
        <WarmupCard />
        <BadgesCard badges={badgeStates(streak)} />
      </div>
    </div>
  )
}
