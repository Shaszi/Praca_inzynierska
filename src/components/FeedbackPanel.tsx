import type { Level, StrokeEvaluation } from '../features/practice/utils/strokeEvaluation'
import { ArrowRightIcon } from './icons'
import { Button, Eyebrow } from './ui'

type FeedbackPanelProps = {
  evaluation: StrokeEvaluation | null
  canProceed?: boolean
  canRetry?: boolean
  isLastStroke?: boolean
  onNextStroke?: () => void
  onRetry?: () => void
  emptyText?: string
}

const TONE: Record<Level, { text: string; bar: string; dot: string; verdict: string }> = {
  good: { text: 'text-success', bar: 'bg-success', dot: 'bg-success', verdict: 'Bardzo dobrze' },
  warn: { text: 'text-warn', bar: 'bg-warn', dot: 'bg-warn', verdict: 'Do poprawy' },
  bad: { text: 'text-danger', bar: 'bg-danger', dot: 'bg-danger', verdict: 'Spróbuj jeszcze raz' },
}

const SEGMENT_NAMES = { start: 'Początek', middle: 'Środek', end: 'Koniec' } as const

function ScoreBlock({ evaluation }: { evaluation: StrokeEvaluation }) {
  const tone = TONE[evaluation.level]
  return (
    <div className="w-full sm:w-56">
      <div className="flex items-center gap-4">
        <span className={`font-mono text-[44px] font-medium leading-none tracking-[-0.03em] ${tone.text}`}>
          {evaluation.score}
        </span>
        <p className="text-[17px] font-bold leading-tight text-ink">{tone.verdict}</p>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-paper-dim">
        <div
          className={`h-full rounded-full transition-all duration-500 ${tone.bar}`}
          style={{ width: `${evaluation.score}%` }}
        />
      </div>
    </div>
  )
}

function Details({ evaluation }: { evaluation: StrokeEvaluation }) {
  return (
    <>
      <ul className="mt-3 flex flex-wrap gap-2">
        {evaluation.segments.map((segment) => (
          <li
            key={segment.key}
            className="inline-flex min-h-8 items-center gap-2 rounded-full border border-line bg-surface-dim px-3 text-[13px]"
          >
            <span className={`h-2.5 w-2.5 rounded-full ${TONE[segment.level].dot}`} aria-hidden />
            <span className="font-semibold text-ink">{SEGMENT_NAMES[segment.key]}</span>
            <span className="text-ink-faint">{segment.issues[0]?.label ?? 'dobrze'}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2.5 font-mono text-xs text-ink-faint">
        długość {Math.round(evaluation.lengthRatio * 100)}% · start {Math.round(evaluation.startGapPx)} px · koniec{' '}
        {Math.round(evaluation.endGapPx)} px · tempo {Math.round(evaluation.speedPxPerSec)} px/s
      </p>
    </>
  )
}

export function FeedbackPanel({
  evaluation,
  canProceed = false,
  canRetry = false,
  isLastStroke = false,
  onNextStroke,
  onRetry,
  emptyText = 'Narysuj kreskę po wskazanej linii, a pojawi się tu ocena.',
}: FeedbackPanelProps) {
  const hasResult = evaluation !== null && !evaluation.tooShort

  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-[18px] sm:flex-row sm:items-center">
      {hasResult && <ScoreBlock evaluation={evaluation} />}

      <div className="min-w-0 flex-1">
        <Eyebrow>Ocena kreski</Eyebrow>
        <p className={`mt-1.5 text-[15px] font-medium leading-relaxed ${evaluation ? 'text-ink' : 'text-ink-faint'}`}>
          {evaluation?.summary ?? emptyText}
        </p>
        {hasResult && <Details evaluation={evaluation} />}
      </div>

      {(canProceed || canRetry) && (
        <div className="flex shrink-0 gap-2">
          {canRetry && onRetry && <Button onClick={onRetry}>Powtórz</Button>}
          {canProceed && onNextStroke && (
            <Button variant="primary" onClick={onNextStroke}>
              {isLastStroke ? 'Zakończ' : 'Dalej'}
              {!isLastStroke && <ArrowRightIcon className="h-4 w-4" />}
            </Button>
          )}
        </div>
      )}
    </section>
  )
}
