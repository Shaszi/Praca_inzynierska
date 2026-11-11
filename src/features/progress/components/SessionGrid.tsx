import { useEffect, useState } from 'react'
import { progressService, type PracticeAttempt, type PracticeSessionSummary } from '../services/progressService'
import { StrokeThumbnail } from './StrokeThumbnail'

const dateFormat = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export function SessionGrid({ sessions }: { sessions: PracticeSessionSummary[] }) {
  const [openId, setOpenId] = useState<string | null>(null)

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {sessions.map((session) => (
        <SessionCard
          key={session.id}
          session={session}
          isOpen={openId === session.id}
          onToggle={() => setOpenId((current) => (current === session.id ? null : session.id))}
        />
      ))}
    </ul>
  )
}

function SessionCard({
  session,
  isOpen,
  onToggle,
}: {
  session: PracticeSessionSummary
  isOpen: boolean
  onToggle: () => void
}) {
  return (
    <li
      className={`overflow-hidden rounded-[18px] border border-line bg-surface ${isOpen ? 'col-span-full' : ''}`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full cursor-pointer text-left"
        aria-expanded={isOpen}
      >
        {!isOpen && (
          <div className="aspect-square border-b border-line bg-paper p-3">
            {session.finalStrokes?.length ? (
              <StrokeThumbnail strokes={session.finalStrokes} className="h-full w-full" />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-ink-faint">brak podglądu</div>
            )}
          </div>
        )}
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
      </button>

      {isOpen && <AttemptList sessionId={session.id} />}
    </li>
  )
}

/** Kroki jednej sesji. Dociągane dopiero przy rozwinięciu — kart jest kilkanaście. */
function AttemptList({ sessionId }: { sessionId: string }) {
  const [attempts, setAttempts] = useState<PracticeAttempt[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    progressService
      .getAttempts(sessionId)
      .then((loaded) => {
        if (!cancelled) setAttempts(loaded)
      })
      .catch(() => {
        if (!cancelled) setError('Nie udało się pobrać kroków tej sesji.')
      })
    return () => {
      cancelled = true
    }
  }, [sessionId])

  if (error) return <p className="border-t border-line px-3 py-3 text-sm text-ink-faint">{error}</p>
  if (!attempts) return <p className="border-t border-line px-3 py-3 text-sm text-ink-faint">Ładowanie kroków…</p>
  if (attempts.length === 0) {
    return <p className="border-t border-line px-3 py-3 text-sm text-ink-faint">Ta sesja nie ma zapisanych kroków.</p>
  }

  return (
    <ol className="m-0 flex list-none flex-col border-t border-line p-0">
      {attempts.map((attempt) => (
        <li
          key={`${attempt.stepIndex}-${attempt.createdAt}`}
          className="flex gap-3 border-b border-line px-3 py-2.5 last:border-b-0"
        >
          <span className="min-w-[72px] shrink-0 font-mono text-[12.5px] text-ink-faint">
            Kreska {attempt.stepIndex + 1}
          </span>
          <span className="min-w-[38px] shrink-0 font-mono text-[13px] font-semibold text-ink-soft">
            {attempt.score === null ? '—' : Math.round(attempt.score)}
          </span>
          <div className="min-w-0 flex-1">
            {attempt.feedback && <p className="m-0 text-[13.5px] text-ink-soft">{attempt.feedback}</p>}
            {attempt.aiFeedback && (
              <p className="m-0 text-[13.5px] text-ink-faint">
                <b className="text-accent">AI:</b> {attempt.aiFeedback}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}
