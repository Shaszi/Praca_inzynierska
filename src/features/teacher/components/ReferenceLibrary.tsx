import { useState } from 'react'
import { Button } from '../../../components/ui'
import type { ReferenceDrawing } from '../../../types/drawing'
import { plural } from '../../../utils/plural'
import { StrokeThumbnail } from '../../progress/components/StrokeThumbnail'

type ReferenceLibraryProps = {
  references: ReferenceDrawing[]
  selectedId: string
  isLoading: boolean
  onLoad: (id: string) => void
  onExport: (id: string) => void
  onDelete: (id: string) => Promise<void>
}

export function ReferenceLibrary({ references, selectedId, isLoading, onLoad, onExport, onDelete }: ReferenceLibraryProps) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  if (isLoading) {
    return <p className="px-1 py-6 text-sm text-ink-faint">Ładowanie wzorców…</p>
  }

  if (references.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line-strong px-4 py-8 text-center text-sm text-ink-soft">
        Zapisane wzorce pojawią się tutaj.
      </p>
    )
  }

  return (
    <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-1">
      {references.map((reference) => {
        const isSelected = reference.id === selectedId
        const isConfirming = reference.id === confirmingId
        return (
          <li
            key={reference.id}
            className={[
              'group flex flex-col overflow-hidden rounded-xl border bg-surface transition lg:flex-row lg:items-center',
              isSelected ? 'border-ink' : 'border-line hover:border-line-strong',
            ].join(' ')}
          >
            <button
              type="button"
              onClick={() => onLoad(reference.id)}
              title="Wczytaj na płótno"
              className="flex min-w-0 flex-1 flex-col text-left lg:flex-row lg:items-center lg:gap-3 lg:p-2"
            >
              <span className="block aspect-square w-full shrink-0 border-b border-line bg-paper p-2 lg:h-12 lg:w-12 lg:rounded-lg lg:border lg:p-1.5">
                <StrokeThumbnail strokes={reference.strokes} className="h-full w-full" />
              </span>
              <span className="min-w-0 px-3 py-2 lg:px-0 lg:py-0">
                <span className="block truncate text-sm font-medium text-ink">{reference.name}</span>
                <span className="block text-xs text-ink-faint">
                  {reference.strokes.length} {plural(reference.strokes.length, 'kreska', 'kreski', 'kresek')}
                </span>
              </span>
            </button>

            <div className="flex items-center gap-0.5 px-2 pb-2 lg:pb-0 lg:pr-2">
              {isConfirming ? (
                <>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={async () => {
                      await onDelete(reference.id)
                      setConfirmingId(null)
                    }}
                  >
                    Usuń
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmingId(null)}>
                    Anuluj
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" size="sm" onClick={() => onExport(reference.id)} title="Pobierz jako JSON">
                    JSON
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => setConfirmingId(reference.id)}>
                    Usuń
                  </Button>
                </>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
