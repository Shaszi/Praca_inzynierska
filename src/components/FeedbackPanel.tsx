import { coverageWords } from '../features/practice/utils/coverageWords'
import type { StrokeComment } from '../services/aiStrokeAnalysis'
import type { Level, LiveProgress, StrokeEvaluation } from '../features/practice/utils/strokeEvaluation'
import { Ring } from './Ring'
import { Button, TypingDots } from './ui'

type FeedbackPanelProps = {
  evaluation: StrokeEvaluation | null
  /** Niepuste, gdy użytkownik właśnie prowadzi kreskę. */
  live?: LiveProgress | null
  /** Krótkie okno po puszczeniu kreski, w którym wynik się odsłania. */
  isAnalysing?: boolean
  canProceed?: boolean
  canRetry?: boolean
  isLastStroke?: boolean
  onNextStroke?: () => void
  onRetry?: () => void
  emptyText?: string
  /** Komentarz modelu do tej kreski. Algorytm mówi co, model — dlaczego i jak poprawić. */
  comment?: StrokeComment | null
  isCommentPending?: boolean
  commentError?: string | null
}

const TONE: Record<Level, { ring: string; verdict: string }> = {
  good: { ring: 'var(--color-success)', verdict: 'Bardzo dobrze' },
  warn: { ring: 'var(--color-warn)', verdict: 'Do poprawy' },
  bad: { ring: 'var(--color-danger)', verdict: 'Jeszcze raz' },
}

const SEGMENT_NAMES = { start: 'Początek', middle: 'Środek', end: 'Koniec' } as const

function accuracyColor(accuracy: number): string {
  if (accuracy >= 80) return 'var(--color-success)'
  if (accuracy >= 55) return 'var(--color-warn)'
  return 'var(--color-danger)'
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3.5 rounded-[22px] border border-line bg-surface p-[18px]">{children}</section>
  )
}

/** Kółko oceny przy wierszu listy: ptaszek na dobrze, wykrzyknik na uwadze. */
function Check({
  level,
  name,
  detail,
  index,
}: {
  level: Level
  name: string
  detail: string
  index: number
}) {
  const background =
    level === 'good' ? 'var(--color-success)' : level === 'warn' ? 'var(--color-warn)' : 'var(--color-danger)'

  return (
    <li
      className="check-in flex items-center gap-3 border-b border-line py-[9px] last:border-b-0"
      // Wiersze wchodzą po kolei, żeby wynik „składał się" na oczach.
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <span
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[15px] font-extrabold text-on-accent"
        style={{ background }}
        aria-hidden
      >
        {level === 'good' ? '✓' : '!'}
      </span>
      <div className="min-w-0">
        <b className="block text-[14.5px] font-semibold">{name}</b>
        <small className="text-[13.5px] text-ink-faint">{detail}</small>
      </div>
    </li>
  )
}

/** Opis tempa — w projekcie prędkość jest czwartym wierszem listy, obok trzech tercji. */
function speedCheck(evaluation: StrokeEvaluation): { level: Level; detail: string } {
  const speed = Math.round(evaluation.speedPxPerSec)
  if (speed < 50) return { level: 'bad', detail: 'Za wolno, linia się wyrysowuje' }
  if (speed < 90) return { level: 'warn', detail: 'Trochę wolno' }
  return { level: 'good', detail: 'Spokojna, tak trzymaj' }
}

export function FeedbackPanel({
  evaluation,
  live = null,
  isAnalysing = false,
  canProceed = false,
  canRetry = false,
  isLastStroke = false,
  onNextStroke,
  onRetry,
  emptyText = 'Narysuj kreskę po wskazanej linii, a pojawi się tu ocena.',
  comment = null,
  isCommentPending = false,
  commentError = null,
}: FeedbackPanelProps) {
  // 1. Prowadzisz kreskę — pierścień rośnie razem z pokryciem wzoru.
  if (live) {
    return (
      <Shell>
        <div className="flex items-center gap-4">
          <Ring
            percent={live.coverage}
            color={accuracyColor(live.accuracy)}
            label={`Narysowane: ${coverageWords(live.coverage)}`}
          >
            <span className="font-mono">{Math.round(live.coverage)}</span>
          </Ring>
          <div className="min-w-0">
            <strong className="block font-display text-[20px] font-bold leading-[1.15]">Rysujesz…</strong>
            <p className="text-sm text-ink-faint">{coverageWords(live.coverage)}</p>
          </div>
        </div>
        <p className="text-[15px] text-ink-soft">
          Dokończ linię, żeby zobaczyć ocenę. Margines błędu to{' '}
          <span className="font-mono">±{Math.round(live.tolerancePx)} px</span>.
        </p>
      </Shell>
    )
  }

  const hasResult = evaluation !== null && !evaluation.tooShort

  // 2. Puściłeś kreskę — wynik się odsłania.
  if (isAnalysing && hasResult) {
    return (
      <Shell>
        <div className="flex items-center gap-4">
          <Ring percent={evaluation.score} color={TONE[evaluation.level].ring} label="Sprawdzanie kreski">
            <span className="font-mono">{evaluation.score}</span>
          </Ring>
          <div className="min-w-0">
            <strong className="block font-display text-[20px] font-bold leading-[1.15]">Sprawdzam kreskę</strong>
            <p className="flex items-center gap-2 text-sm text-ink-faint">
              Mierzę odchylenie, drżenie i tempo <TypingDots />
            </p>
          </div>
        </div>
      </Shell>
    )
  }

  if (!hasResult) {
    return (
      <Shell>
        <h3 className="text-[15px] font-semibold text-ink-faint">Ocena kreski</h3>
        <p className="text-[15px] text-ink-faint">{evaluation?.summary ?? emptyText}</p>
      </Shell>
    )
  }

  // 3. Wynik.
  const tone = TONE[evaluation.level]
  const speed = speedCheck(evaluation)
  const worstIssue = evaluation.segments.flatMap((segment) => segment.issues)[0] ?? null

  return (
    <Shell>
      <div className="flex items-center gap-4">
        <Ring percent={evaluation.score} color={tone.ring} label={`Ocena: ${evaluation.score} na 100`}>
          <span className="font-mono">{evaluation.score}</span>
        </Ring>
        <div className="min-w-0">
          <strong className="block font-display text-[20px] font-bold leading-[1.15]">{tone.verdict}</strong>
          <p className="text-sm text-ink-faint">{evaluation.score} na 100 punktów</p>
        </div>
      </div>

      <ul className="m-0 flex list-none flex-col p-0">
        {evaluation.segments.map((segment, index) => (
          <Check
            key={segment.key}
            index={index}
            level={segment.level}
            name={SEGMENT_NAMES[segment.key]}
            detail={segment.issues[0]?.label ?? 'Trafiony w punkt'}
          />
        ))}
        <Check index={3} level={speed.level} name="Szybkość" detail={speed.detail} />
      </ul>

      {worstIssue && (
        <p
          className="check-in m-0 rounded-[16px] border border-[rgb(255_216_74_/_0.35)] bg-[rgb(255_216_74_/_0.09)] px-3.5 py-3 text-[14.5px] text-ink-soft"
          style={{ animationDelay: '320ms' }}
        >
          <b className="text-accent">Spróbuj tak:</b> {worstIssue.sentence}
        </p>
      )}

      <AiComment comment={comment} isPending={isCommentPending} error={commentError} />

      {(canProceed || canRetry) && (
        <div className="flex flex-nowrap gap-2">
          {canProceed && onNextStroke && (
            <Button variant="primary" size="sm" className="flex-1" onClick={onNextStroke}>
              {isLastStroke ? 'Zakończ' : 'Następna kreska'}
            </Button>
          )}
          {canRetry && onRetry && (
            <Button variant="secondary" size="sm" className="flex-1" onClick={onRetry}>
              Powtórz
            </Button>
          )}
        </div>
      )}
    </Shell>
  )
}

/** Miejsce na odpowiedź modelu — pod oceną algorytmu, żeby było jasne, co skąd pochodzi. */
function AiComment({
  comment,
  isPending,
  error,
}: {
  comment: StrokeComment | null
  isPending: boolean
  error: string | null
}) {
  if (!isPending && !comment && !error) return null

  return (
    <section
      className="check-in m-0 flex flex-col gap-1.5 rounded-[16px] border border-accent/30 bg-accent-soft px-3.5 py-3"
      style={{ animationDelay: '400ms' }}
      aria-live="polite"
    >
      <h4 className="m-0 flex items-center gap-2 text-[12.5px] font-bold tracking-[0.08em] text-accent uppercase">
        Komentarz AI
        {isPending && <TypingDots />}
      </h4>
      {isPending && <p className="m-0 text-[14.5px] text-ink-faint">Model czyta pomiary tej kreski…</p>}
      {error && !isPending && <p className="m-0 text-[14.5px] text-ink-faint">{error}</p>}
      {comment && !isPending && (
        <>
          <p className="m-0 text-[14.5px] text-ink-soft">{comment.mistake}</p>
          <p className="m-0 text-[14.5px] text-ink-soft">
            <b className="text-accent">Następny raz:</b> {comment.fix}
          </p>
        </>
      )}
    </section>
  )
}
