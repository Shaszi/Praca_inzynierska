import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { Button, Segmented, Spinner } from '../../../components/ui'
import { segmentAt } from '../segmenter'
import { maskCoverage, polygonMask, type SubjectMask } from '../subjectMask'
import { LassoSurface } from './LassoSurface'

type PickMode = 'tap' | 'lasso'

const MODES: { value: PickMode; label: string }[] = [
  { value: 'tap', label: 'Stuknij w obiekt' },
  { value: 'lasso', label: 'Lasso' },
]

const HINTS: Record<PickMode, { title: string; body: string }> = {
  tap: {
    title: 'Stuknij w obiekt, który chcesz narysować',
    body: 'Kurs powstanie tylko z tego obiektu — tło zostanie pominięte. Stuknij jeszcze raz, żeby zmienić wybór.',
  },
  lasso: {
    title: 'Obrysuj palcem to, co chcesz narysować',
    body: 'Prowadź pętlę dookoła obiektu, nie po jego krawędzi — kurs weźmie linie z wnętrza. Narysuj jeszcze raz, żeby poprawić.',
  },
}

const TINT = [62, 230, 168, 120] as const

export function SubjectPicker({
  imageUrl,
  image,
  onConfirm,
  onCancel,
}: {
  imageUrl: string
  image: HTMLImageElement
  onConfirm: (mask: SubjectMask | null) => void
  onCancel: () => void
}) {
  const [mode, setMode] = useState<PickMode>('tap')
  const [mask, setMask] = useState<SubjectMask | null>(null)
  const [loop, setLoop] = useState<{ x: number; y: number }[] | null>(null)
  const [isWorking, setIsWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = overlayRef.current
    if (!canvas || !mask || mask.soft) return
    canvas.width = mask.width
    canvas.height = mask.height
    const tinted = new ImageData(mask.width, mask.height)
    mask.data.forEach((value, i) => {
      if (value) tinted.data.set(TINT, i * 4)
    })
    canvas.getContext('2d')?.putImageData(tinted, 0, 0)
  }, [mask])

  const handleTap = async (event: PointerEvent<HTMLImageElement>) => {
    if (isWorking) return
    const rect = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width
    const y = (event.clientY - rect.top) / rect.height
    setIsWorking(true)
    setError(null)
    try {
      const next = await segmentAt(image, x, y)
      const coverage = maskCoverage(next)
      if (coverage < 0.003 || coverage > 0.97) {
        setError('Nie udało się wyodrębnić obiektu. Stuknij bliżej jego środka.')
        return
      }
      setMask(next)
    } catch (err) {
      console.error(err)
      setError('Nie udało się uruchomić zaznaczania. Sprawdź połączenie i spróbuj ponownie.')
    } finally {
      setIsWorking(false)
    }
  }

  const changeMode = (next: PickMode) => {
    setMode(next)
    setMask(null)
    setLoop(null)
    setError(null)
  }

  const handleLasso = (points: { x: number; y: number }[]) => {
    const next = polygonMask(points, image.naturalWidth, image.naturalHeight)
    if (maskCoverage(next) < 0.01) {
      setError('Pętla jest za mała. Obrysuj cały obiekt jednym ruchem.')
      return
    }
    setError(null)
    setLoop(points)
    setMask(next)
  }

  return (
    <section className="flex w-full flex-1 flex-col items-center gap-4">
      <Segmented options={MODES} value={mode} onChange={changeMode} ariaLabel="Sposób zaznaczania" />
      <div className="text-center">
        <p className="text-[22px] font-bold text-ink">{HINTS[mode].title}</p>
        <p className="mt-1 text-ink-soft">{HINTS[mode].body}</p>
      </div>

      <div className="relative inline-block max-w-full">
        <img
          src={imageUrl}
          alt="Zdjęcie do zaznaczenia obiektu"
          onPointerDown={mode === 'tap' ? handleTap : undefined}
          draggable={false}
          className="block max-h-[62vh] w-auto max-w-full cursor-crosshair rounded-[18px] select-none"
        />
        {mode === 'tap' && mask && (
          <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full rounded-[18px]" />
        )}
        {mode === 'lasso' && (
          <LassoSurface width={image.naturalWidth} height={image.naturalHeight} loop={loop} onComplete={handleLasso} />
        )}
        {isWorking && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center rounded-[18px] bg-paper/40">
            <Spinner className="h-8 w-8" />
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-[16px] bg-danger-soft px-3.5 py-3 text-sm font-medium text-danger">
          {error}
        </p>
      )}

      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="primary" disabled={!mask || isWorking} onClick={() => onConfirm(mask)}>
          {mode === 'lasso' ? 'Rysuj zaznaczenie' : 'Rysuj ten obiekt'}
        </Button>
        <Button variant="secondary" disabled={isWorking} onClick={() => onConfirm(null)}>
          Całe zdjęcie
        </Button>
        <Button variant="ghost" disabled={isWorking} onClick={onCancel}>
          Zmień zdjęcie
        </Button>
      </div>
    </section>
  )
}
