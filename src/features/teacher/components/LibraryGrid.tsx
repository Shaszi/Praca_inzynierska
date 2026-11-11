import { useState } from 'react'
import { Button } from '../../../components/ui'
import type { Publication, ReferenceDrawing } from '../../../types/drawing'
import { plural } from '../../../utils/plural'
import { StrokeThumbnail } from '../../progress/components/StrokeThumbnail'

const STATUS: Record<Publication, { label: string; tone: string }> = {
  private: { label: 'Prywatny', tone: 'bg-surface-dim text-ink-faint' },
  pending: { label: 'Czeka na sprawdzenie', tone: 'bg-warn-soft text-warn' },
  public: { label: 'Opublikowany', tone: 'bg-success-soft text-success' },
  rejected: { label: 'Odrzucony', tone: 'bg-danger-soft text-danger' },
}

export type LibraryAction = {
  label: string
  onRun: (id: string) => void | Promise<void>
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  /** Gdy zwróci false, przycisk nie pojawia się na tej karcie. */
  when?: (reference: ReferenceDrawing) => boolean
  /** Dwustopniowe potwierdzenie — dla akcji nieodwracalnych. */
  confirm?: boolean
}

export function LibraryGrid({
  references,
  isLoading,
  emptyText,
  actions,
}: {
  references: ReferenceDrawing[]
  isLoading: boolean
  emptyText: string
  actions: LibraryAction[]
}) {
  const [confirming, setConfirming] = useState<string | null>(null)

  if (isLoading) {
    return <p className="px-1 py-10 text-sm text-ink-faint">Ładowanie wzorców…</p>
  }

  if (references.length === 0) {
    return (
      <p className="rounded-[22px] border border-dashed border-line-strong px-5 py-12 text-center text-ink-soft">
        {emptyText}
      </p>
    )
  }

  return (
    <ul className="grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {references.map((reference) => {
        const status = STATUS[reference.publication ?? 'private']
        const key = `${reference.id}`

        return (
          <li
            key={reference.id}
            className="flex flex-col gap-3 rounded-[24px] border border-line bg-surface p-3"
          >
            <div
              className="grid aspect-[4/3] place-items-center rounded-[16px] bg-paper-dim"
              style={{ backgroundImage: 'var(--canvas-dots)', backgroundSize: '22px 22px' }}
            >
              <StrokeThumbnail strokes={reference.strokes} className="h-[78%] w-[78%]" />
            </div>

            <div className="flex min-w-0 flex-col gap-1 px-1">
              <b className="truncate text-[15px] font-semibold" title={reference.name}>
                {reference.name}
              </b>
              <span className="font-mono text-[12.5px] text-ink-faint">
                {reference.strokes.length} {plural(reference.strokes.length, 'kreska', 'kreski', 'kresek')}
                {reference.authorName ? ` · ${reference.authorName}` : ''}
              </span>
              <span className={`mt-1 self-start rounded-full px-2.5 py-1 text-[12px] font-bold ${status.tone}`}>
                {status.label}
              </span>
              {reference.publication === 'rejected' && reference.moderationReason && (
                <span className="text-[12.5px] text-danger">Powód: {reference.moderationReason}</span>
              )}
            </div>

            <div className="mt-auto flex flex-wrap gap-1.5 px-1 pb-1">
              {actions
                .filter((action) => !action.when || action.when(reference))
                .map((action) => {
                  const isConfirming = confirming === `${key}:${action.label}`
                  return (
                    <Button
                      key={action.label}
                      size="sm"
                      variant={isConfirming ? 'danger' : (action.variant ?? 'ghost')}
                      onClick={() => {
                        if (action.confirm && !isConfirming) {
                          setConfirming(`${key}:${action.label}`)
                          return
                        }
                        setConfirming(null)
                        void action.onRun(reference.id)
                      }}
                    >
                      {isConfirming ? 'Na pewno?' : action.label}
                    </Button>
                  )
                })}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
