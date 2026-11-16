import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../../../components/ui'
import { StrokeThumbnail } from '../../../progress/components/StrokeThumbnail'
import type { ImageProject } from '../../../progress/services/progressService'
import { EditableTitle } from '../EditableTitle'

export function ImageProjectCard({
  project,
  onRename,
  onDelete,
}: {
  project: ImageProject
  onRename: (title: string) => Promise<void>
  onDelete: () => Promise<void>
}) {
  const [isConfirming, setIsConfirming] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const remove = async () => {
    setIsDeleting(true)
    setError(null)
    try {
      await onDelete()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się usunąć projektu.')
      setIsDeleting(false)
    }
  }

  return (
    <li className="flex flex-col gap-2 rounded-[18px] border border-line bg-surface p-3">
      <div className="grid aspect-[4/3] place-items-center rounded-[14px] bg-paper-dim">
        {project.strokes.length > 0 ? (
          <StrokeThumbnail strokes={project.strokes} className="h-[80%] w-[80%]" />
        ) : (
          <span className="text-xs text-ink-faint">jeszcze pusty</span>
        )}
      </div>
      <EditableTitle title={project.title} onRename={onRename} />
      <small className="text-[12.5px] text-ink-faint">
        {project.isDone ? 'Ukończony' : `Krok ${project.stepIndex + 1} z ${project.stepsTotal}`}
      </small>

      {isConfirming ? (
        <div className="mt-auto flex flex-col gap-2" role="group" aria-label="Potwierdź usunięcie">
          <p className="text-[13px] text-ink-soft">Usunąć projekt razem ze zdjęciem i kreskami? Tego nie da się cofnąć.</p>
          <div className="flex gap-2">
            <Button variant="danger" size="sm" className="flex-1" disabled={isDeleting} onClick={remove}>
              {isDeleting ? 'Usuwam…' : 'Usuń'}
            </Button>
            <Button variant="ghost" size="sm" disabled={isDeleting} onClick={() => setIsConfirming(false)}>
              Anuluj
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-auto flex gap-2">
          <Link
            to={`/app/practice/image?session=${project.id}`}
            className="inline-flex min-h-9 flex-1 items-center justify-center rounded-full bg-accent px-3.5 text-sm font-semibold text-on-accent transition hover:bg-accent-strong"
          >
            {project.isDone ? 'Otwórz' : 'Wróć do projektu'}
          </Link>
          <Button variant="danger" size="sm" onClick={() => setIsConfirming(true)}>
            Usuń
          </Button>
        </div>
      )}
      {error && (
        <small role="alert" className="text-[12.5px] text-danger">
          {error}
        </small>
      )}
    </li>
  )
}
