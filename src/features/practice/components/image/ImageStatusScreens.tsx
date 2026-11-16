import { Link } from 'react-router-dom'
import { Button, Spinner } from '../../../../components/ui'
import { StrokeThumbnail } from '../../../progress/components/StrokeThumbnail'
import type { Stroke } from '../../../../types/drawing'

export function ImageAnalyzingScreen() {
  return (
    <section className="flex w-full flex-1 flex-col items-center justify-center gap-4 text-center">
      <Spinner className="h-8 w-8" />
      <div>
        <p className="text-[22px] font-bold text-ink">Analizuję zdjęcie</p>
        <p className="mt-1 text-ink-soft">AI przygotowuje plan rysowania krok po kroku.</p>
      </div>
    </section>
  )
}

export function ImageDoneScreen({
  imageUrl,
  strokes,
  stepsTotal,
  saveError,
  onRestart,
}: {
  imageUrl: string | null
  strokes: Stroke[]
  stepsTotal: number
  saveError: string | null
  onRestart: () => void
}) {
  return (
    <section className="flex w-full flex-1 flex-col items-center justify-center gap-8 py-8 text-center">
      <div className="flex items-center gap-4">
        {imageUrl && (
          <img src={imageUrl} alt="Zdjęcie wzorcowe" className="h-32 w-32 rounded-[22px] border border-line object-cover sm:h-40 sm:w-40" />
        )}
        <div className="h-32 w-32 rounded-[22px] border border-line bg-surface p-3 sm:h-40 sm:w-40">
          <StrokeThumbnail strokes={strokes} className="h-full w-full" />
        </div>
      </div>
      <div>
        <h2 className="text-[26px] font-bold tracking-[-0.01em] text-ink">Rysunek ukończony</h2>
        <p className="mx-auto mt-2 max-w-md text-ink-soft">
          Wszystkie kroki ({stepsTotal}) za Tobą. Rysunek zapisał się w historii i liczy się do dzisiejszego celu.
        </p>
        {saveError && <p className="mt-2 text-sm text-danger">{saveError}</p>}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Link
          to="/app/progress"
          className="flex min-h-11 items-center rounded-full border border-ink-faint bg-surface px-4 text-[15px] font-semibold text-ink transition hover:bg-surface-dim"
        >
          Zobacz postęp
        </Link>
        <Button variant="primary" onClick={onRestart}>
          Wgraj nowe zdjęcie
        </Button>
      </div>
    </section>
  )
}
