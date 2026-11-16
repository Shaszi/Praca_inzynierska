import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ImageIcon } from '../components/icons'
import { Button, PageHeader, Spinner } from '../components/ui'
import { BrushPanel } from '../features/canvas/components/BrushPanel'
import { useBrushSettings } from '../features/canvas/hooks/useBrushSettings'
import { useCanvasColors } from '../features/canvas/utils/themeColors'
import { PracticeLayout } from '../features/practice/components/PracticeLayout'
import { PracticeToolbar } from '../features/practice/components/PracticeToolbar'
import { StrokeMeter } from '../features/practice/components/StrokeMeter'
import { usePracticeAnalysis } from '../features/practice/hooks/usePracticeAnalysis'
import { FeedbackPanel } from '../components/FeedbackPanel'
import { DrawingCanvas } from '../features/canvas/components/DrawingCanvas'
import { useSmoothingSettings } from '../features/canvas/hooks/useSmoothingSettings'
import { StrokeThumbnail } from '../features/progress/components/StrokeThumbnail'
import { usePracticeSession } from '../features/progress/hooks/usePracticeSession'
import { photoService, downscaleToJpeg } from '../features/progress/services/photoService'
import { progressService, type ImageProject } from '../features/progress/services/progressService'
import { useSingleLayer } from '../features/canvas/hooks/useLayers'
import { useStrokes } from '../hooks/useStrokes'
import {
  analyzeStrokeAgainstImage,
  buildContourCourse,
  readImageSize,
  type ImageGuideStep,
  type SupportedMediaType,
} from '../services/aiImageGuide'
import { describeAiError } from '../services/aiClient'
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

/** Zdjęcie przez płótno: stamtąd biorą się piksele dla detekcji konturów. */
async function readPixels(
  url: string,
): Promise<{ pixels: Uint8ClampedArray; width: number; height: number; image: HTMLImageElement }> {
  const image = new Image()
  image.src = url
  await image.decode()
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('Przeglądarka nie dała kontekstu 2D.')
  context.drawImage(image, 0, 0)
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
  return { pixels: data, width: canvas.width, height: canvas.height, image }
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
  // Rozmiar własny zdjęcia: w tych pikselach model podaje linie, w nich rysujemy tło.
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null)

  // Te same ustawienia pędzla co w ćwiczeniu z wzorcem — jeden hook, jeden zapis.
  const { brush, setBrush } = useBrushSettings()
  const [isBrushOpen, setIsBrushOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [tool, setTool] = useState<Tool>('brush')
  const { smoothing } = useSmoothingSettings()
  const colors = useCanvasColors()
  const [isAnalyzingAI, setIsAnalyzingAI] = useState(false)
  const [aiFeedback, setAiFeedback] = useState<string | null>(null)
  const [awaitingNext, setAwaitingNext] = useState(false)
  /** Numer próby: odpowiedź modelu starsza niż bieżąca próba nie ma już gdzie trafić. */
  const attemptRef = useRef(0)
  const [photoPath, setPhotoPath] = useState<string | null>(null)
  const [resumedSessionId, setResumedSessionId] = useState<string | null>(null)
  const [searchParams] = useSearchParams()
  const [projects, setProjects] = useState<ImageProject[]>([])

  // Lista projektów tylko na ekranie wgrywania — tam jej się szuka.
  useEffect(() => {
    if (phase !== 'upload') return
    let cancelled = false
    progressService
      .listImageProjects()
      .then((list) => !cancelled && setProjects(list))
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [phase])

  const {
    strokes, addStroke, undoStroke, redoStroke, clearStrokes, replaceStrokes,
    beginEraseSession, eraseInSession, endEraseSession, canUndo, canRedo,
  } = useStrokes()
  const canvasLayers = useSingleLayer(strokes)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const sessionParams = useMemo(
    () =>
      steps.length > 0
        ? {
            mode: 'image' as const,
            title: imageName || 'Rysunek ze zdjęcia',
            stepsTotal: steps.length,
            photoPath,
            course: steps,
            existingSessionId: resumedSessionId,
          }
        : null,
    [imageName, photoPath, resumedSessionId, steps],
  )
  const { recordAttempt, complete: completeSession, reset: resetSession, saveProgress, saveError } =
    usePracticeSession(sessionParams)

  // Wznowienie projektu: kurs, zdjęcie, kreski i krok biorą się z bazy, a nie
  // z ponownej analizy — druga detekcja konturów dałaby inny podział na kroki.
  const sessionParam = searchParams.get('session')
  const restoredRef = useRef<string | null>(null)
  // `replaceStrokes` przez ref, nie przez listę zależności: gdy efekt restartuje się
  // w połowie wczytywania, strażnik `restoredRef` blokuje drugie podejście i strona
  // zostaje na zawsze na ekranie „Analizuję zdjęcie".
  const replaceStrokesRef = useRef(replaceStrokes)
  useEffect(() => {
    replaceStrokesRef.current = replaceStrokes
  }, [replaceStrokes])

  useEffect(() => {
    if (!sessionParam || restoredRef.current === sessionParam) return
    restoredRef.current = sessionParam

    setPhase('analyzing')
    progressService
      .getProject(sessionParam)
      .then(async (project) => {
        if (!project?.course || project.course.length === 0) {
          setAnalyzeError('Nie znaleziono tego projektu albo nie da się go wznowić.')
          setPhase('upload')
          return
        }
        const url = project.photoPath ? await photoService.signedUrl(project.photoPath) : null
        const course = project.course as ImageGuideStep[]

        setImageName(project.title)
        setPhotoPath(project.photoPath)
        setResumedSessionId(sessionParam)
        setSteps(course)
        setStepIndex(Math.min(project.stepIndex, course.length - 1))
        replaceStrokesRef.current(project.strokes)
        if (url) {
          setImageUrl(url)
          // Rozmiar z pliku, bo kurs jest w pikselach oryginału, a nie zmniejszonej kopii.
          setImageSize(await readImageSize(url))
        }
        setPhase('practicing')
      })
      .catch(() => {
        setAnalyzeError('Nie udało się otworzyć projektu.')
        setPhase('upload')
      })
  }, [sessionParam])

  const processFile = useCallback(async (file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type as SupportedMediaType)) {
      setAnalyzeError('Nieobsługiwany format. Użyj JPG, PNG, WebP lub GIF.')
      return
    }
    setAnalyzeError(null)
    setPhase('analyzing')
    try {
      const { base64, mediaType: mt } = await readFileAsBase64(file)
      const url = URL.createObjectURL(file)
      // Piksele są potrzebne do konturów, więc zdjęcie i tak musi przejść przez płótno.
      const { pixels, width, height, image } = await readPixels(url)
      setImageUrl(url)
      setImageSize({ width, height })
      setImageBase64(base64)
      setMediaType(mt)
      setImageName(file.name.replace(/\.[^.]+$/, ''))
      const generatedSteps = await buildContourCourse(pixels, width, height, base64, mt)
      // Zdjęcie do Storage dopiero teraz: gdy model nie dał planu, nie ma czego zapisywać.
      const stored = await photoService.upload(await downscaleToJpeg(image)).catch(() => null)
      setPhotoPath(stored)
      setResumedSessionId(null)
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
  // Stabilna tożsamość: płótno przelicza widok, gdy obrys się zmieni, a nie co render.
  const fitBounds = useMemo(
    () => (imageSize ? { minX: 0, minY: 0, maxX: imageSize.width, maxY: imageSize.height } : null),
    [imageSize],
  )
  // Krok ma zawsze dokładnie jedną linię (patrz splitToSingleContourSteps), więc ocena
  // porównuje kreskę z tym, co użytkownik naprawdę ma narysować.
  const guideStroke = currentStep?.strokes[0] ?? null
  const { evaluation, live, analyzeActiveStroke, evaluateCompletedStroke, resetAnalysis } =
    usePracticeAnalysis(guideStroke)

  const handleEraseAtPoint = useCallback(
    (point: Point) => { eraseInSession((prev) => eraseAtPoint(prev, point.x, point.y, brush.width)) },
    [brush.width, eraseInSession],
  )

  const handleStrokeComplete = useCallback(async (stroke: Stroke, rawPoints: Point[]) => {
    addStroke(stroke)
    if (!currentStep) return
    // Ocena lokalna liczy się natychmiast z linii pomocniczej kroku; komentarz modelu
    // dochodzi chwilę później, tak samo jak w ćwiczeniu z wzorcem.
    const result = evaluateCompletedStroke(stroke, rawPoints)
    // Kliknięcie albo urwany ruch nie jest próbą: panel oceny nie miałby co pokazać,
    // a razem z nim zniknęłyby przyciski i krok byłby nie do opuszczenia.
    if (result?.tooShort) {
      undoStroke()
      return
    }
    // Ocena lokalna wystarczy, żeby iść dalej — nie każemy czekać na model.
    setAwaitingNext(true)
    setIsAnalyzingAI(true)
    setAiFeedback(null)
    const attempt = ++attemptRef.current
    let feedback: string | null = null
    try {
      feedback = await analyzeStrokeAgainstImage(
        strokes, stroke, imageBase64, mediaType, currentStep.title, currentStep.description,
      )
      // Użytkownik mógł w tym czasie przejść dalej albo powtórzyć kreskę; wtedy ten
      // komentarz dotyczy już nieistniejącej próby i nie wolno go pokazać.
      if (attemptRef.current === attempt) setAiFeedback(feedback)
    } finally {
      if (attemptRef.current === attempt) setIsAnalyzingAI(false)
      recordAttempt({
        stepIndex,
        stroke,
        score: result && !result.tooShort ? result.score : null,
        feedback: result && !result.tooShort ? result.summary : null,
        aiFeedback: feedback,
      })
    }
  }, [addStroke, currentStep, evaluateCompletedStroke, undoStroke, strokes, imageBase64, mediaType, recordAttempt, stepIndex])

  const handleNextStep = useCallback(() => {
    if (stepIndex >= steps.length - 1) { setPhase('done'); completeSession(strokes); return }
    attemptRef.current++
    // Zapis po każdym kroku: do projektu wracamy dokładnie tu, gdzie się skończyło.
    saveProgress(stepIndex + 1, strokes)
    setStepIndex((i) => i + 1)
    setAiFeedback(null)
    setAwaitingNext(false)
    setIsAnalyzingAI(false)
    resetAnalysis()
  }, [stepIndex, steps.length, completeSession, resetAnalysis, saveProgress, strokes])

  const handleRetry = useCallback(() => {
    attemptRef.current++
    undoStroke(); setAiFeedback(null); setAwaitingNext(false); setIsAnalyzingAI(false); resetAnalysis()
  }, [resetAnalysis, undoStroke])

  const handleUndo = useCallback(() => {
    undoStroke(); setAiFeedback(null); setAwaitingNext(false)
  }, [undoStroke])

  const handleClear = useCallback(() => {
    clearStrokes(); setAiFeedback(null); setAwaitingNext(false); setIsAnalyzingAI(false); setStepIndex(0); resetSession()
  }, [clearStrokes, resetSession])

  const resetAll = useCallback(() => {
    setPhase('upload'); setImageUrl(null); setImageBase64(''); setSteps([]); setImageSize(null)
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
          className={`flex flex-1 cursor-pointer flex-col items-center justify-center gap-4 rounded-[22px] border-2 border-dashed px-6 py-20 text-center transition ${
            isDragging ? 'border-accent bg-accent-soft/40' : 'border-ink-faint bg-surface hover:border-accent hover:bg-accent-soft/40'
          }`}
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-paper-dim text-ink">
            <ImageIcon className="h-7 w-7" />
          </span>
          <div>
            <p className="font-medium text-ink">Przeciągnij zdjęcie tutaj albo kliknij, żeby wybrać plik</p>
            <p className="mt-1 text-sm text-ink-faint">JPG, PNG, WebP lub GIF</p>
          </div>
          <input ref={fileInputRef} type="file" accept={ACCEPTED_TYPES.join(',')} className="hidden" onChange={handleFileChange} />
        </div>
        {analyzeError && (
          <p className="rounded-[16px] bg-danger-soft px-3.5 py-3 text-sm font-medium text-danger">{analyzeError}</p>
        )}

        {projects.length > 0 && (
          <section className="flex flex-col gap-3">
            <h3 className="text-[15px] font-semibold text-ink-faint">Twoje projekty</h3>
            <ul className="grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-4">
              {projects.map((project) => (
                <li key={project.id} className="flex flex-col gap-2 rounded-[18px] border border-line bg-surface p-3">
                  <div className="grid aspect-[4/3] place-items-center rounded-[14px] bg-paper-dim">
                    {project.strokes.length > 0 ? (
                      <StrokeThumbnail strokes={project.strokes} className="h-[80%] w-[80%]" />
                    ) : (
                      <span className="text-xs text-ink-faint">jeszcze pusty</span>
                    )}
                  </div>
                  <b className="truncate text-[14.5px]" title={project.title}>{project.title}</b>
                  <small className="text-[12.5px] text-ink-faint">
                    {project.isDone ? 'Ukończony' : `Krok ${project.stepIndex + 1} z ${project.stepsTotal}`}
                  </small>
                  <Link
                    to={`/app/practice/image?session=${project.id}`}
                    className="mt-auto inline-flex min-h-9 items-center justify-center rounded-full bg-accent px-3.5 text-sm font-semibold text-on-accent transition hover:bg-accent-strong"
                  >
                    {project.isDone ? 'Otwórz' : 'Wróć do projektu'}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
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
            <img src={imageUrl} alt="Zdjęcie wzorcowe" className="h-32 w-32 rounded-[22px] border border-line object-cover sm:h-40 sm:w-40" />
          )}
          <div className="h-32 w-32 rounded-[22px] border border-line bg-surface p-3 sm:h-40 sm:w-40">
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
            className="flex min-h-11 items-center rounded-full border border-ink-faint bg-surface px-4 text-[15px] font-semibold text-ink transition hover:bg-surface-dim"
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
  const canProceed = awaitingNext
  const canRetry = awaitingNext && canUndo
  const isLastStep = stepIndex >= steps.length - 1

  return (
    <section className="flex min-h-0 w-full flex-1 flex-col gap-4">
      <PageHeader
        title="Rysunek ze zdjęcia"
        description="Poprowadź rękę po podświetlonej linii — to krok z planu, który AI zrobiło z Twojego zdjęcia."
      >
        {imageUrl && (
          <img src={imageUrl} alt="Zdjęcie wzorcowe" className="h-10 w-10 rounded-[12px] object-cover" />
        )}
        <Button variant="ghost" size="sm" onClick={resetAll}>
          Zmień zdjęcie
        </Button>
      </PageHeader>

      {saveError && (
        <p className="rounded-[16px] bg-danger-soft px-3.5 py-3 text-sm font-medium text-danger">{saveError}</p>
      )}

      {/* Kanwa bierze resztę, ocena siedzi w szynie 340 px; na pełnym ekranie oba idą do menu. */}
      <PracticeLayout
        isFullscreen={isFullscreen}
        tools={
          <>
          <div className="relative">
            <PracticeToolbar
              tool={tool}
              onToolChange={setTool}
              title={imageName}
              stepIndex={stepIndex}
              stepsTotal={steps.length}
              stepNoun="Krok"
              onOpenBrush={() => setIsBrushOpen((open) => !open)}
              isBrushOpen={isBrushOpen}
              onUndo={handleUndo}
              onRedo={redoStroke}
              onClear={handleClear}
              canUndo={canUndo}
              canRedo={canRedo}
              isFullscreen={isFullscreen}
              onToggleFullscreen={() => setIsFullscreen((open) => !open)}
            />
            {isBrushOpen && (
              <div className="absolute top-full right-0 z-20 mt-2">
                <BrushPanel brush={brush} onChange={setBrush} canvasBackground="#0d0b20" />
              </div>
            )}
          </div>

          {guideStroke && (
            <StrokeMeter
              live={live}
              finalCoverage={awaitingNext && evaluation && !evaluation.tooShort ? evaluation.lengthRatio * 100 : null}
            />
          )}

          </>
        }
        canvas={
          <div className="relative min-h-[420px] min-w-0 flex-1">
            <DrawingCanvas
              layers={canvasLayers}
              // Tylko linie bieżącego kroku: poprzednie są już narysowane ręką użytkownika.
              referenceStrokes={currentStep?.strokes ?? []}
              fitBounds={fitBounds}
              backgroundImageSize={imageSize}
              brushSize={brush.width}
              brushOpacity={brush.opacity}
              userStrokeColor={brush.color}
              referenceStrokeColor={colors.violet}
              tool={tool}
              smoothing={smoothing}
              onStrokeComplete={handleStrokeComplete}
              onEraseStart={beginEraseSession}
              onEraseAtPoint={handleEraseAtPoint}
              onEraseEnd={endEraseSession}
              onActiveStrokeChange={analyzeActiveStroke}
              showCursorPreview
              backgroundImageUrl={imageUrl ?? undefined}
            />
            {canProceed && (
              // Na tablecie panel oceny bywa pod płótnem — przycisk musi być tam, gdzie ręka.
              <Button variant="primary" className="absolute right-3 bottom-3 z-10 shadow-lg" onClick={handleNextStep}>
                {isLastStep ? 'Zakończ' : 'Następny krok'}
              </Button>
            )}
          </div>
        }
        panel={
          <>
          <section className="flex flex-col gap-2 rounded-[22px] border border-line bg-surface p-[18px]">
            <h3 className="text-[15px] font-semibold text-ink-faint">
              Krok {stepIndex + 1} z {steps.length}
            </h3>
            {currentStep && (
              <>
                <strong className="font-display text-[20px] leading-[1.15] font-bold">{currentStep.title}</strong>
                <p className="text-[15px] text-ink-soft">{currentStep.description}</p>
              </>
            )}
            <div className="mt-1 flex flex-wrap gap-[3px]" aria-hidden>
              {steps.map((step, index) => (
                <span
                  key={step.id}
                  className={`h-1.5 rounded-full transition-all ${
                    index < stepIndex ? 'w-4 bg-success' : index === stepIndex ? 'w-[26px] bg-accent' : 'w-4 bg-surface-dim'
                  }`}
                />
              ))}
            </div>
          </section>

          <FeedbackPanel
            evaluation={evaluation}
            live={live}
            canProceed={canProceed}
            canRetry={canRetry}
            isLastStroke={isLastStep}
            onNextStroke={handleNextStep}
            onRetry={handleRetry}
            emptyText="Narysuj ten krok po podświetlonej linii, a pojawi się tu ocena."
            nextLabel="Następny krok"
            commentText={aiFeedback}
            isCommentPending={isAnalyzingAI}
          />
          </>
        }
      />
    </section>
  )
}
