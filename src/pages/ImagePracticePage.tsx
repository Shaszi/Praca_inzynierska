import { useCallback, useEffect, useRef, useState } from 'react'
import { DrawingCanvas } from '../features/canvas/components/DrawingCanvas'
import { useStrokes } from '../hooks/useStrokes'
import {
  analyzeStrokeAgainstImage,
  generateImageSteps,
  type ImageGuideStep,
  type SupportedMediaType,
} from '../services/aiImageGuide'
import type { Point, Stroke, Tool } from '../types/drawing'
import { eraseAtPoint } from '../utils/eraser'

type Phase = 'upload' | 'analyzing' | 'practicing' | 'done'

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

function LoadingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-sky-500 [animation-delay:0ms]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-sky-500 [animation-delay:150ms]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-sky-500 [animation-delay:300ms]" />
    </span>
  )
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

  const [brushSize, setBrushSize] = useState(5)
  const [tool, setTool] = useState<Tool>('brush')
  const [isAnalyzingAI, setIsAnalyzingAI] = useState(false)
  const [aiFeedback, setAiFeedback] = useState<string | null>(null)
  const [awaitingNext, setAwaitingNext] = useState(false)

  const {
    strokes, addStroke, undoStroke, redoStroke, clearStrokes,
    beginEraseSession, eraseInSession, endEraseSession, canUndo, canRedo,
  } = useStrokes()

  const fileInputRef = useRef<HTMLInputElement>(null)

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
      const generatedSteps = await generateImageSteps(base64, mt)
      setSteps(generatedSteps)
      setStepIndex(0)
      setPhase('practicing')
    } catch {
      setAnalyzeError('Błąd analizy zdjęcia. Sprawdź klucz API i spróbuj ponownie.')
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
    try {
      const feedback = await analyzeStrokeAgainstImage(
        [...strokes, stroke], imageBase64, mediaType, currentStep.title, currentStep.description,
      )
      setAiFeedback(feedback)
    } finally {
      setIsAnalyzingAI(false)
      setAwaitingNext(true)
    }
  }, [addStroke, currentStep, strokes, imageBase64, mediaType])

  const handleNextStep = useCallback(() => {
    if (stepIndex >= steps.length - 1) { setPhase('done'); return }
    setStepIndex((i) => i + 1)
    setAiFeedback(null)
    setAwaitingNext(false)
  }, [stepIndex, steps.length])

  const handleRetry = useCallback(() => {
    undoStroke(); setAiFeedback(null); setAwaitingNext(false); setIsAnalyzingAI(false)
  }, [undoStroke])

  const handleUndo = useCallback(() => {
    undoStroke(); setAiFeedback(null); setAwaitingNext(false)
  }, [undoStroke])

  const handleClear = useCallback(() => {
    clearStrokes(); setAiFeedback(null); setAwaitingNext(false); setIsAnalyzingAI(false); setStepIndex(0)
  }, [clearStrokes])

  const resetAll = useCallback(() => {
    setPhase('upload'); setImageUrl(null); setImageBase64(''); setSteps([])
    clearStrokes(); setAiFeedback(null); setAwaitingNext(false); setStepIndex(0)
  }, [clearStrokes])

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

  // Shared wrapper — extends edge-to-edge by cancelling AppLayout padding
  const fullArea = 'relative -m-4 md:-m-6 flex min-h-0 flex-1 overflow-hidden'

  // --- Upload phase ---
  if (phase === 'upload') {
    return (
      <section className={fullArea}>
        <div className="flex w-full flex-col items-center justify-center gap-6 p-6">
          <div className="text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Tryb zdjęcia</p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-900">Ćwicz ze swojego zdjęcia</h2>
            <p className="mt-2 text-slate-500">
              Wgraj zdjęcie — AI podzieli je na kroki i poprowadzi Cię przez rysowanie.
            </p>
          </div>
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`flex w-full max-w-md cursor-pointer flex-col items-center gap-4 rounded-2xl border-2 border-dashed p-12 transition ${
              isDragging ? 'border-sky-400 bg-sky-50' : 'border-slate-300 bg-white hover:border-sky-300 hover:bg-sky-50/50'
            }`}
          >
            <svg className="h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <div className="text-center">
              <p className="font-medium text-slate-700">Przeciągnij zdjęcie lub kliknij</p>
              <p className="mt-1 text-sm text-slate-400">JPG, PNG, WebP, GIF</p>
            </div>
            <input ref={fileInputRef} type="file" accept={ACCEPTED_TYPES.join(',')} className="hidden" onChange={handleFileChange} />
          </div>
          {analyzeError && (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{analyzeError}</p>
          )}
        </div>
      </section>
    )
  }

  // --- Analyzing phase ---
  if (phase === 'analyzing') {
    return (
      <section className={fullArea}>
        <div className="flex w-full flex-col items-center justify-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-sky-200 border-t-sky-500" />
          <p className="text-lg font-medium text-slate-700">Analizuję zdjęcie...</p>
          <p className="text-sm text-slate-400">AI przygotowuje plan rysowania</p>
        </div>
      </section>
    )
  }

  // --- Done phase ---
  if (phase === 'done') {
    return (
      <section className={fullArea}>
        <div className="flex w-full flex-col items-center justify-center gap-6">
          <div className="text-center">
            <p className="text-5xl">🎉</p>
            <h2 className="mt-4 text-3xl font-semibold text-slate-900">Ćwiczenie ukończone!</h2>
            <p className="mt-2 text-slate-500">Przeszedłeś przez wszystkie {steps.length} kroków.</p>
          </div>
          <button
            type="button"
            onClick={resetAll}
            className="rounded-xl bg-sky-500 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-sky-600"
          >
            Wgraj nowe zdjęcie
          </button>
        </div>
      </section>
    )
  }

  // --- Practicing phase — full-screen canvas with floating panels ---
  const canProceed = awaitingNext && !isAnalyzingAI
  const canRetry = awaitingNext && !isAnalyzingAI && canUndo
  const isLastStep = stepIndex >= steps.length - 1

  return (
    <section className={fullArea}>
      {/* Canvas fills entire area via absolute positioning */}
      <div className="absolute inset-0">
        <DrawingCanvas
          userStrokes={strokes}
          brushSize={brushSize}
          tool={tool}
          onStrokeComplete={handleStrokeComplete}
          onEraseStart={beginEraseSession}
          onEraseAtPoint={handleEraseAtPoint}
          onEraseEnd={endEraseSession}
          showCursorPreview
          backgroundImageUrl={imageUrl ?? undefined}
        />
      </div>

      {/* TOP-LEFT: toolbar */}
      <div className="pointer-events-auto absolute left-4 top-4 z-10 flex items-center gap-1.5 rounded-2xl border border-slate-200/80 bg-white/85 px-3 py-2 shadow-lg backdrop-blur-md">
        {/* Tool toggle */}
        <button
          type="button"
          onClick={() => setTool('brush')}
          className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${tool === 'brush' ? 'bg-sky-500 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
        >
          Pędzel
        </button>
        <button
          type="button"
          onClick={() => setTool('eraser')}
          className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${tool === 'eraser' ? 'bg-rose-400 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
        >
          Gumka
        </button>

        <div className="mx-1 h-4 w-px bg-slate-200" />

        {/* Size */}
        <span className="text-xs text-slate-400">{tool === 'brush' ? 'Rozmiar' : 'Gumka'}</span>
        <input
          type="range" min={2} max={30} value={brushSize}
          onChange={(e) => setBrushSize(Number(e.target.value))}
          className="w-20 accent-sky-500"
        />
        <span className="w-5 text-center text-xs font-semibold text-slate-700">{brushSize}</span>

        <div className="mx-1 h-4 w-px bg-slate-200" />

        {/* Actions */}
        <button
          type="button"
          onClick={handleUndo}
          disabled={!canUndo}
          className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
        >
          Cofnij
        </button>
        <button
          type="button"
          onClick={handleClear}
          className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
        >
          Wyczyść
        </button>
        <button
          type="button"
          onClick={resetAll}
          className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          ← Zmień zdjęcie
        </button>
      </div>

      {/* TOP-RIGHT: step progress */}
      <div className="pointer-events-none absolute right-4 top-4 z-10 flex items-center gap-2.5 rounded-2xl border border-slate-200/80 bg-white/85 px-3 py-2 shadow-lg backdrop-blur-md">
        {imageUrl && (
          <img src={imageUrl} alt="wzorzec" className="h-8 w-8 rounded-lg object-cover" />
        )}
        <div className="min-w-0">
          <p className="text-xs text-slate-400">Krok {stepIndex + 1} / {steps.length}</p>
          <p className="max-w-[160px] truncate text-sm font-semibold text-slate-800">{currentStep?.title}</p>
        </div>
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-700">
          {stepIndex + 1}
        </div>
      </div>

      {/* BOTTOM: step instruction + AI feedback */}
      <div className="pointer-events-auto absolute bottom-4 left-4 right-4 z-10 overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 shadow-xl backdrop-blur-md">
        {/* Step instruction */}
        {currentStep && (
          <div className="border-b border-amber-100 bg-amber-50/90 px-4 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-600">
              {currentStep.title}
            </span>
            <p className="mt-0.5 text-sm text-amber-900">{currentStep.description}</p>
          </div>
        )}

        {/* AI feedback row */}
        <div className="flex items-start gap-4 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-widest text-slate-400">Analiza AI</p>
            {isAnalyzingAI ? (
              <div className="mt-1.5 flex items-center gap-2 text-slate-500">
                <LoadingDots />
                <span className="text-sm">Analizuję kreskę...</span>
              </div>
            ) : aiFeedback ? (
              <p className="mt-1 text-sm leading-relaxed text-slate-800">{aiFeedback}</p>
            ) : (
              <p className="mt-1 text-sm text-slate-400">Narysuj kreskę, aby uzyskać feedback.</p>
            )}
          </div>

          {(canProceed || canRetry) && (
            <div className="flex shrink-0 items-center gap-2 self-center">
              {canRetry && (
                <button
                  type="button"
                  onClick={handleRetry}
                  className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-100 active:scale-95"
                >
                  Spróbuj jeszcze raz
                </button>
              )}
              {canProceed && (
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-600 active:scale-95"
                >
                  {isLastStep ? 'Zakończ ćwiczenie' : 'Następny krok →'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
