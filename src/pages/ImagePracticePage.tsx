import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRightIcon, ImageIcon } from '../components/icons'
import { Button, Divider, PageHeader, rangeClass, Segmented, Spinner, TypingDots } from '../components/ui'
import { DrawingCanvas } from '../features/canvas/components/DrawingCanvas'
import { SmoothingControl } from '../features/canvas/components/SmoothingControl'
import { useSmoothingSettings } from '../features/canvas/hooks/useSmoothingSettings'
import { StrokeThumbnail } from '../features/progress/components/StrokeThumbnail'
import { usePracticeSession } from '../features/progress/hooks/usePracticeSession'
import { useStrokes } from '../hooks/useStrokes'
import {
  analyzeStrokeAgainstImage,
  generateImageSteps,
  type ImageGuideStep,
  type SupportedMediaType,
} from '../services/aiImageGuide'
import { describeAiError } from '../services/aiClient'
import type { Point, Stroke, Tool } from '../types/drawing'
import { eraseAtPoint } from '../utils/eraser'

type Phase = 'upload' | 'analyzing' | 'practicing' | 'done'

const TOOL_OPTIONS: { value: Tool; label: string }[] = [
  { value: 'brush', label: 'Pędzel' },
  { value: 'eraser', label: 'Gumka' },
]

const ACCEPTED_TYPES: SupportedMediaType[] = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

function readFileAsBase64(file: File): Promise<{ base64: string; mediaType: SupportedMediaType }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve({ base64: result.split(',')[1], mediaType: file.type as SupportedMediaType })
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function ImagePracticePage() {
  const [phase, setPhase] = useState<Phase>('upload')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageBase64, setImageBase64] = useState<string>('')
  const [mediaType, setMediaType] = useState<SupportedMediaType>('image/jpeg')
  const [steps, setSteps] = useState<ImageGuideStep[]>([])
  const [stepIndex, setStepIndex] = useState(0)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [imageName, setImageName] = useState('')

  const [brushSize, setBrushSize] = useState(5)
  const [tool, setTool] = useState<Tool>('brush')
  const { smoothing, setSmoothing } = useSmoothingSettings()
  const [isAnalyzingAI, setIsAnalyzingAI] = useState(false)
  const [aiFeedback, setAiFeedback] = useState<string | null>(null)
  const [awaitingNext, setAwaitingNext] = useState(false)

  const {
    strokes, addStroke, undoStroke, redoStroke, clearStrokes,
    beginEraseSession, eraseInSession, endEraseSession, canUndo, canRedo,
  } = useStrokes()

  const fileInputRef = useRef<HTMLInputElement>(null)

  const sessionParams = useMemo(
    () =>
      steps.length > 0
        ? { mode: 'image' as const, title: imageName || 'Rysunek ze zdjęcia', stepsTotal: steps.length }
        : null,
    [imageName, steps.length],
  )
  const { recordAttempt, complete: completeSession, reset: resetSession, saveError } = usePracticeSession(sessionParams)

  const processFile = useCallback(async (file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type as SupportedMediaType)) {
      setAnalyzeError('Nieobsługiwany format. Użyj JPG, PNG, WebP lub GIF.')
      return
    }
    setAnalyzeError(null)
    setPhase('analyzing')
    try {
      const { base64, mediaType: mt } = await readFileAsBase64(file)
      setImageUrl(URL.createObjectURL(file))
      setImageBase64(base64)
      setMediaType(mt)
      setImageName(file.name.replace(/\.[^.]+$/, ''))
      const generatedSteps = await generateImageSteps(base64, mt)
      setSteps(generatedSteps)
      setStepIndex(0)
      setPhase('practicing')
    } catch (error) {
      setAnalyzeError(describeAiError(error))
      setPhase('upload')
    }
  }, [])

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) processFile(f) },
    [processFile],
  )
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false)
    const f = e.dataTransfer.files[0]; if (f) processFile(f)
  }, [processFile])
  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }, [])
  const handleDragLeave = useCallback(() => setIsDragging(false), [])

  const currentStep = steps[stepIndex] ?? null

  const handleEraseAtPoint = useCallback(
    (point: Point) => { eraseInSession((prev) => eraseAtPoint(prev, point.x, point.y, brushSize)) },
    [brushSize, eraseInSession],
  )

  const handleStrokeComplete = useCallback(async (stroke: Stroke) => {
    addStroke(stroke)
    if (!currentStep) return
    setIsAnalyzingAI(true)
    setAiFeedback(null)
    setAwaitingNext(false)
    let feedback: string | null = null
    try {
      feedback = await analyzeStrokeAgainstImage(
        [...strokes, stroke], imageBase64, mediaType, currentStep.title, currentStep.description,
      )
      setAiFeedback(feedback)
    } finally {
      setIsAnalyzingAI(false)
      setAwaitingNext(true)
      recordAttempt({ stepIndex, stroke, score: null, aiFeedback: feedback })
    }
  }, [addStroke, currentStep, strokes, imageBase64, mediaType, recordAttempt, stepIndex])

  const handleNextStep = useCallback(() => {
    if (stepIndex >= steps.length - 1) { setPhase('done'); completeSession(strokes); return }
    setStepIndex((i) => i + 1)
    setAiFeedback(null)
    setAwaitingNext(false)
  }, [stepIndex, steps.length, completeSession, strokes])

  const handleRetry = useCallback(() => {
    undoStroke(); setAiFeedback(null); setAwaitingNext(false); setIsAnalyzingAI(false)
  }, [undoStroke])

  const handleUndo = useCallback(() => {
    undoStroke(); setAiFeedback(null); setAwaitingNext(false)
  }, [undoStroke])

  const handleClear = useCallback(() => {
    clearStrokes(); setAiFeedback(null); setAwaitingNext(false); setIsAnalyzingAI(false); setStepIndex(0); resetSession()
  }, [clearStrokes, resetSession])

  const resetAll = useCallback(() => {
    setPhase('upload'); setImageUrl(null); setImageBase64(''); setSteps([])
    clearStrokes(); setAiFeedback(null); setAwaitingNext(false); setStepIndex(0); resetSession()
  }, [clearStrokes, resetSession])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.metaKey && !e.ctrlKey) return
      const k = e.key.toLowerCase()
      if (k === 'z' && !e.shiftKey && canUndo) { e.preventDefault(); handleUndo() }
      if ((k === 'y' || (k === 'z' && e.shiftKey)) && canRedo) { e.preventDefault(); redoStroke() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canUndo, canRedo, handleUndo, redoStroke])

  // Shared wrapper — full-height card holding the canvas and floating panels
  const fullArea = 'relative flex min-h-[600px] flex-1 overflow-hidden rounded-2xl border border-line bg-surface'

  // --- Upload phase ---
  if (phase === 'upload') {
    return (
      <section className="flex w-full flex-1 flex-col gap-6">
        <PageHeader
          title="Rysuj ze zdjęcia"
          description="Wgraj zdjęcie, a AI rozpisze je na kroki — od głównych brył do detali — i oceni każdy etap."
        />
        <div
          role="button"
          tabIndex={0}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click() }}
          className={`flex flex-1 cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed px-6 py-20 text-center transition ${
            isDragging ? 'border-accent bg-accent-soft/40' : 'border-line-strong bg-surface hover:border-accent hover:bg-accent-soft/40'
          }`}
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-paper-dim text-ink">
            <ImageIcon className="h-7 w-7" />
          </span>
          <div>
            <p className="font-medium text-ink">Przeciągnij zdjęcie tutaj albo kliknij, żeby wybrać plik</p>
            <p className="mt-1 text-sm text-ink-faint">JPG, PNG, WebP lub GIF</p>
          </div>
          <input ref={fileInputRef} type="file" accept={ACCEPTED_TYPES.join(',')} className="hidden" onChange={handleFileChange} />
        </div>
        {analyzeError && (
          <p className="rounded-xl bg-danger-soft px-3.5 py-3 text-sm font-medium text-danger">{analyzeError}</p>
        )}
      </section>
    )
  }

  // --- Analyzing phase ---
  if (phase === 'analyzing') {
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

  // --- Done phase ---
  if (phase === 'done') {
    return (
      <section className="flex w-full flex-1 flex-col items-center justify-center gap-8 py-8 text-center">
        <div className="flex items-center gap-4">
          {imageUrl && (
            <img src={imageUrl} alt="Zdjęcie wzorcowe" className="h-32 w-32 rounded-2xl border border-line object-cover sm:h-40 sm:w-40" />
          )}
          <div className="h-32 w-32 rounded-2xl border border-line bg-surface p-3 sm:h-40 sm:w-40">
            <StrokeThumbnail strokes={strokes} className="h-full w-full" />
          </div>
        </div>
        <div>
          <h2 className="text-[26px] font-bold tracking-[-0.01em] text-ink">Rysunek ukończony</h2>
          <p className="mx-auto mt-2 max-w-md text-ink-soft">
            Wszystkie kroki ({steps.length}) za Tobą. Rysunek zapisał się w historii i liczy się do dzisiejszego celu.
          </p>
          {saveError && <p className="mt-2 text-sm text-danger">{saveError}</p>}
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Link
            to="/app/progress"
            className="flex min-h-11 items-center rounded-[10px] border border-line-strong bg-surface px-4 text-[15px] font-semibold text-ink transition hover:bg-surface-dim"
          >
            Zobacz postęp
          </Link>
          <Button variant="primary" onClick={resetAll}>
            Wgraj nowe zdjęcie
          </Button>
        </div>
      </section>
    )
  }

  // --- Practicing phase — full-screen canvas with floating panels ---
  const canProceed = awaitingNext && !isAnalyzingAI
  const canRetry = awaitingNext && !isAnalyzingAI && canUndo
  const isLastStep = stepIndex >= steps.length - 1
  const floating =
    'rounded-xl border border-line bg-surface/90 shadow-[0_8px_24px_-12px_rgba(29,28,26,0.25)] backdrop-blur-md'

  return (
    <section className={fullArea}>
      {/* Canvas fills entire area via absolute positioning */}
      <div className="absolute inset-0 [&>div]:rounded-none [&>div]:border-0">
        <DrawingCanvas
          userStrokes={strokes}
          brushSize={brushSize}
          tool={tool}
          smoothing={smoothing}
          onStrokeComplete={handleStrokeComplete}
          onEraseStart={beginEraseSession}
          onEraseAtPoint={handleEraseAtPoint}
          onEraseEnd={endEraseSession}
          showCursorPreview
          backgroundImageUrl={imageUrl ?? undefined}
        />
      </div>

      {/* TOP: toolbar + step progress */}
      <div className="pointer-events-none absolute inset-x-4 top-4 z-10 flex flex-wrap items-start justify-between gap-2">
        <div className={`pointer-events-auto flex flex-wrap items-center gap-x-2 gap-y-1.5 px-2.5 py-2 ${floating}`}>
          <Segmented
            options={TOOL_OPTIONS}
            value={tool}
            onChange={setTool}
            ariaLabel="Narzędzie"
          />
          <Divider />
          <label className="flex items-center gap-2">
            <span className="text-[13px] text-ink-soft">Rozmiar</span>
            <input
              type="range" min={2} max={30} value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className={`w-20 ${rangeClass}`}
            />
            <span className="w-5 text-right text-xs tabular-nums text-ink-soft">{brushSize}</span>
          </label>
          <Divider />
          <SmoothingControl value={smoothing} onChange={setSmoothing} />
          <Divider />
          <Button variant="ghost" size="sm" onClick={handleUndo} disabled={!canUndo}>Cofnij</Button>
          <Button variant="danger" size="sm" onClick={handleClear}>Wyczyść</Button>
          <Button variant="ghost" size="sm" onClick={resetAll}>Zmień zdjęcie</Button>
        </div>

        <div className={`pointer-events-auto flex items-center gap-3 px-2.5 py-2 ${floating}`}>
          {imageUrl && <img src={imageUrl} alt="Zdjęcie wzorcowe" className="h-9 w-9 rounded-lg object-cover" />}
          <div className="min-w-0">
            <p className="font-mono text-xs uppercase tracking-[0.04em] text-ink-faint">Krok {stepIndex + 1} z {steps.length}</p>
            <div className="mt-1 flex gap-[3px]">
              {steps.map((step, index) => (
                <span
                  key={step.id}
                  className={`h-1.5 w-4 rounded-full ${
                    index < stepIndex ? 'bg-accent' : index === stepIndex ? 'bg-ink' : 'bg-paper-dim'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM: step instruction + AI feedback */}
      <div className={`absolute inset-x-4 bottom-4 z-10 overflow-hidden ${floating}`}>
        {currentStep && (
          <div className="border-b border-line px-4 py-3">
            <p className="text-[13px] font-medium text-accent-strong">{currentStep.title}</p>
            <p className="mt-0.5 text-[15px] text-ink">{currentStep.description}</p>
          </div>
        )}

        <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] text-ink-faint">Komentarz</p>
            {isAnalyzingAI ? (
              <div className="mt-1 flex items-center gap-2 text-ink-soft">
                <TypingDots />
                <span className="text-sm">Analizuję rysunek…</span>
              </div>
            ) : (
              <p className={`mt-0.5 text-sm leading-relaxed ${aiFeedback ? 'text-ink' : 'text-ink-faint'}`}>
                {aiFeedback ?? 'Narysuj ten krok, a pojawi się tu ocena.'}
              </p>
            )}
          </div>

          {(canProceed || canRetry) && (
            <div className="flex shrink-0 gap-2">
              {canRetry && <Button onClick={handleRetry}>Jeszcze raz</Button>}
              {canProceed && (
                <Button variant="primary" onClick={handleNextStep}>
                  {isLastStep ? 'Zakończ' : 'Następny krok'}
                  {!isLastStep && <ArrowRightIcon className="h-4 w-4" />}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
