import type { PracticeSessionSummary } from '../services/progressService'
import { StrokeThumbnail } from './StrokeThumbnail'

const dateFormat = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export function SessionGrid({ sessions }: { sessions: PracticeSessionSummary[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {sessions.map((session) => (
        <li key={session.id} className="overflow-hidden rounded-[18px] border border-line bg-surface">
          <div className="aspect-square border-b border-line bg-paper p-3">
            {session.finalStrokes?.length ? (
              <StrokeThumbnail strokes={session.finalStrokes} className="h-full w-full" />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-ink-faint">brak podglądu</div>
            )}
          </div>
          <div className="px-3 py-2.5">
            <p className="truncate text-sm font-medium text-ink" title={session.title}>
              {session.title}
            </p>
            <p className="mt-0.5 flex items-center justify-between gap-2 text-xs text-ink-faint">
              <span>{session.completedAt ? dateFormat.format(new Date(session.completedAt)) : ''}</span>
              {session.averageScore !== null && (
                <span className="font-mono text-ink-soft">{Math.round(session.averageScore)}%</span>
              )}
            </p>
          </div>
        </li>
      ))}
    </ul>
  )
}
