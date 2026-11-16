import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button, PageHeader } from '../components/ui'
import { BrushPanel } from '../features/canvas/components/BrushPanel'
import { useBrushSettings } from '../features/canvas/hooks/useBrushSettings'
import { useCanvasColors } from '../features/canvas/utils/themeColors'
import { NextStepButton } from '../features/practice/components/NextStepButton'
import { PracticeLayout } from '../features/practice/components/PracticeLayout'
import { PracticeToolbar } from '../features/practice/components/PracticeToolbar'
import { ImageProjectList } from '../features/practice/components/image/ImageProjectList'
import { ImageAnalyzingScreen, ImageDoneScreen } from '../features/practice/components/image/ImageStatusScreens'
import { PhotoDropzone } from '../features/practice/components/image/PhotoDropzone'
import { StepCard } from '../features/practice/components/image/StepCard'
import { ACCEPTED_TYPES, readFileAsBase64, readPixels, type LoadedPhoto } from '../features/practice/utils/photoFile'
import { StrokeMeter } from '../features/practice/components/StrokeMeter'
import { SubjectPicker } from '../features/practice/components/SubjectPicker'
import type { SubjectMask } from '../features/practice/subjectMask'
import { usePracticeAnalysis } from '../features/practice/hooks/usePracticeAnalysis'
import { FeedbackPanel } from '../components/FeedbackPanel'
import { DrawingCanvas } from '../features/canvas/components/DrawingCanvas'
import { useSmoothingSettings } from '../features/canvas/hooks/useSmoothingSettings'
import { usePracticeSession } from '../features/progress/hooks/usePracticeSession'
import { photoService, downscaleToJpeg } from '../features/progress/services/photoService'
import { progressService } from '../features/progress/services/progressService'
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

type Phase = 'upload' | 'select' | 'analyzing' | 'practicing' | 'done'

export function ImagePracticePage() {
  const [phase, setPhase] = useState<Phase>('upload')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageBase64, setImageBase64] = useState<string>('')
  const [mediaType, setMediaType] = useState<SupportedMediaType>('image/jpeg')
  const [steps, setSteps] = useState<ImageGuideStep[]>([])
  const [stepIndex, setStepIndex] = useState(0)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const [imageName, setImageName] = useState('')
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null)
  const [loadedPhoto, setLoadedPhoto] = useState<LoadedPhoto | null>(null)

  const { brush, setBrush } = useBrushSettings()
  const [isBrushOpen, setIsBrushOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [tool, setTool] = useState<Tool>('brush')
  const { smoothing } = useSmoothingSettings()
  const colors = useCanvasColors()
  const [isAnalyzingAI, setIsAnalyzingAI] = useState(false)
  const [aiFeedback, setAiFeedback] = useState<string | null>(null)
  const [awaitingNext, setAwaitingNext] = useState(false)
  const attemptRef = useRef(0)
  const [photoPath, setPhotoPath] = useState<string | null>(null)
  const [resumedSessionId, setResumedSessionId] = useState<string | null>(null)
  const [searchParams] = useSearchParams()

  const {
    strokes, addStroke, undoStroke, redoStroke, clearStrokes, replaceStrokes,
    beginEraseSession, eraseInSession, endEraseSession, canUndo, canRedo,
  } = useStrokes()
  const canvasLayers = useSingleLayer(strokes)

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
  const { recordAttempt, complete: completeSession, reset: resetSession, saveProgress, rename: renameSession, saveError } =
    usePracticeSession(sessionParams)

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
    try {
      const { base64, mediaType: mt } = await readFileAsBase64(file)
      const url = URL.createObjectURL(file)
      const loaded = await readPixels(url)
      setImageUrl(url)
      setImageSize({ width: loaded.width, height: loaded.height })
      setImageBase64(base64)
      setMediaType(mt)
      setImageName(file.name.replace(/\.[^.]+$/, ''))
      setLoadedPhoto(loaded)
      setPhase('select')
    } catch (error) {
      setAnalyzeError(describeAiError(error))
      setPhase('upload')
    }
  }, [])

  const buildCourse = useCallback(async (mask: SubjectMask | null) => {
    if (!loadedPhoto) return
    const { pixels, width, height, image } = loadedPhoto
    setAnalyzeError(null)
    setPhase('analyzing')
    try {
      const generatedSteps = await buildContourCourse(pixels, width, height, imageBase64, mediaType, mask)
      const stored = await photoService.upload(await downscaleToJpeg(image)).catch(() => null)
      setPhotoPath(stored)
      setResumedSessionId(null)
      setSteps(generatedSteps)
      setStepIndex(0)
      setPhase('practicing')
    } catch (error) {
      setAnalyzeError(describeAiError(error))
      setPhase('select')
    }
  }, [imageBase64, loadedPhoto, mediaType])


  const currentStep = steps[stepIndex] ?? null
  const fitBounds = useMemo(
    () => (imageSize ? { minX: 0, minY: 0, maxX: imageSize.width, maxY: imageSize.height } : null),
    [imageSize],
  )
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
    const result = evaluateCompletedStroke(stroke, rawPoints)
    if (result?.tooShort) {
      undoStroke()
      return
    }
    setAwaitingNext(true)
    setIsAnalyzingAI(true)
    setAiFeedback(null)
    const attempt = ++attemptRef.current
    let feedback: string | null = null
    try {
      feedback = await analyzeStrokeAgainstImage(
        strokes, stroke, imageBase64, mediaType, currentStep.title, currentStep.description,
      )
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
    setPhase('upload'); setImageUrl(null); setImageBase64(''); setSteps([]); setImageSize(null); setLoadedPhoto(null)
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

  if (phase === 'upload') {
    return (
      <section className="flex w-full flex-1 flex-col gap-6">
        <PageHeader
          title="Rysuj ze zdjęcia"
          description="Wgraj zdjęcie, a AI rozpisze je na kroki — od głównych brył do detali — i oceni każdy etap."
        />
        <PhotoDropzone onFile={processFile} />
        {analyzeError && (
          <p className="rounded-[16px] bg-danger-soft px-3.5 py-3 text-sm font-medium text-danger">{analyzeError}</p>
        )}

        <ImageProjectList />
      </section>
    )
  }

  if (phase === 'select' && imageUrl && loadedPhoto) {
    return (
      <>
        {analyzeError && (
          <p className="rounded-[16px] bg-danger-soft px-3.5 py-3 text-sm font-medium text-danger">{analyzeError}</p>
        )}
        <SubjectPicker imageUrl={imageUrl} image={loadedPhoto.image} onConfirm={buildCourse} onCancel={resetAll} />
      </>
    )
  }

  if (phase === 'analyzing') return <ImageAnalyzingScreen />

  if (phase === 'done') {
    return (
      <ImageDoneScreen imageUrl={imageUrl} strokes={strokes} stepsTotal={steps.length} saveError={saveError} onRestart={resetAll} />
    )
  }

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

      <PracticeLayout
        isFullscreen={isFullscreen}
        tools={
          <>
          <div className="relative">
            <PracticeToolbar
              tool={tool}
              onToolChange={setTool}
              title={imageName}
              onRenameTitle={async (title) => {
                if (!title.trim()) throw new Error('Nazwa nie może być pusta.')
                setImageName(await renameSession(title))
              }}
              stepIndex={stepIndex}
              stepsTotal={steps.length}
              stepNoun="Krok"
              onOpenBrush={() => setIsBrushOpen((open) => !open)}
              isBrushOpen={isBrushOpen}
              brushColor={brush.color}
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
            {canProceed && <NextStepButton isLast={isLastStep} label="Następny krok" onClick={handleNextStep} />}
          </div>
        }
        panel={
          <>
          <StepCard steps={steps} stepIndex={stepIndex} />

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

