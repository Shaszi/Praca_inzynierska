import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ControlBar } from '../components/ControlBar'
import { DebugPanel } from '../components/DebugPanel'
import { Button, Eyebrow, PageHeader } from '../components/ui'
import { DrawingCanvas } from '../features/canvas/components/DrawingCanvas'
import { useSmoothingSettings } from '../features/canvas/hooks/useSmoothingSettings'
import { ImportControl } from '../features/teacher/components/ImportExportControls'
import { ReferenceLibrary } from '../features/teacher/components/ReferenceLibrary'
import { useReferences } from '../features/teacher/hooks/useReferences'
import { useSingleLayer } from '../features/canvas/hooks/useLayers'
import { useStrokes } from '../hooks/useStrokes'
import type { Point, Tool } from '../types/drawing'
import { eraseAtPoint } from '../utils/eraser'

export function TeacherPage() {
  const [brushSize, setBrushSize] = useState(8)
  const [tool, setTool] = useState<Tool>('brush')
  const { smoothing, setSmoothing } = useSmoothingSettings()
  const [isCanvasFullscreen, setIsCanvasFullscreen] = useState(false)
  const [referenceName, setReferenceName] = useState('')

  const {
    strokes,
    strokeCount,
    currentStrokePointCount,
    lastStrokeDurationMs,
    setCurrentStrokePointCount,
    replaceStrokes,
    beginEraseSession,
    eraseInSession,
    endEraseSession,
    addStroke,
    undoStroke,
    redoStroke,
    clearStrokes,
    canUndo,
    canRedo,
  } = useStrokes()
  const canvasLayers = useSingleLayer(strokes)

  const {
    references,
    selectedReferenceId,
    saveReference,
    loadReference,
    deleteReference,
    exportReference,
    importReference,
    statusMessage,
    errorMessage,
    isLoading,
    isSaving,
    isImporting,
  } = useReferences()

  const handleSave = useCallback(
    async (event: FormEvent) => {
      event.preventDefault()
      const saved = await saveReference(strokes, referenceName)
      if (saved) setReferenceName('')
    },
    [referenceName, saveReference, strokes],
  )

  const handleLoad = useCallback(
    (id: string) => {
      const loadedStrokes = loadReference(id)
      if (loadedStrokes) replaceStrokes(loadedStrokes)
    },
    [loadReference, replaceStrokes],
  )

  const handleEraseAtPoint = useCallback(
    (point: Point) => {
      eraseInSession((previousStrokes) => eraseAtPoint(previousStrokes, point.x, point.y, brushSize))
    },
    [brushSize, eraseInSession],
  )

  useEffect(() => {
    if (!isCanvasFullscreen) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsCanvasFullscreen(false)
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isCanvasFullscreen])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMetaOrCtrl = event.metaKey || event.ctrlKey
      if (!isMetaOrCtrl) return

      const key = event.key.toLowerCase()
      const isUndo = key === 'z' && !event.shiftKey
      const isRedo = key === 'y' || (key === 'z' && event.shiftKey)

      if (isUndo && canUndo) {
        event.preventDefault()
        undoStroke()
      }

      if (isRedo && canRedo) {
        event.preventDefault()
        redoStroke()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [canRedo, canUndo, redoStroke, undoStroke])

  return (
    <section className="flex min-h-0 w-full flex-1 flex-col gap-4">
      <PageHeader title="Moje wzorce" description="Narysuj linie, które chcesz ćwiczyć, i zapisz je jako wzorzec.">
        <ImportControl onImport={importReference} isImporting={isImporting} />
      </PageHeader>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div
          className={[
            'flex min-h-0 flex-col gap-3',
            isCanvasFullscreen ? 'fixed inset-0 z-50 bg-paper p-4' : '',
          ].join(' ')}
        >
          <ControlBar
            brushSize={brushSize}
            onBrushSizeChange={setBrushSize}
            minBrushSize={2}
            maxBrushSize={48}
            tool={tool}
            onToolChange={setTool}
            smoothing={smoothing}
            onSmoothingChange={setSmoothing}
            onUndo={undoStroke}
            onRedo={redoStroke}
            onClear={clearStrokes}
            canUndo={canUndo}
            canRedo={canRedo}
            extraControls={
              <Button variant="ghost" size="sm" onClick={() => setIsCanvasFullscreen((current) => !current)}>
                {isCanvasFullscreen ? 'Zamknij pełny ekran' : 'Pełny ekran'}
              </Button>
            }
          />

          <div className="min-h-[420px] flex-1">
            <DrawingCanvas
              layers={canvasLayers}
              brushSize={brushSize}
              tool={tool}
              smoothing={smoothing}
              onStrokeComplete={addStroke}
              onEraseStart={beginEraseSession}
              onEraseAtPoint={handleEraseAtPoint}
              onEraseEnd={endEraseSession}
              onCurrentStrokePointCountChange={setCurrentStrokePointCount}
              showCursorPreview
            />
          </div>

          {!isCanvasFullscreen && (
            <>
              <form
                onSubmit={handleSave}
                className="flex flex-col gap-2 rounded-[18px] border border-line bg-surface p-2 sm:flex-row sm:items-center"
              >
                <input
                  value={referenceName}
                  onChange={(event) => setReferenceName(event.target.value)}
                  placeholder={`Nazwa wzorca, np. „Wzorzec ${references.length + 1}”`}
                  maxLength={120}
                  className="min-w-0 flex-1 min-h-11 rounded-full bg-transparent px-3 text-[15px] text-ink placeholder:text-ink-faint focus:bg-surface-dim focus:outline-none"
                  aria-label="Nazwa wzorca"
                />
                <Button type="submit" variant="primary" disabled={isSaving || strokes.length === 0}>
                  {isSaving ? 'Zapisywanie…' : 'Zapisz jako wzorzec'}
                </Button>
              </form>

              <p className={`text-sm ${errorMessage ? 'text-danger' : 'text-ink-faint'}`} role="status">
                {errorMessage ?? statusMessage}
              </p>

              <DebugPanel
                strokeCount={strokeCount}
                currentStrokePointCount={currentStrokePointCount}
                lastStrokeDurationMs={lastStrokeDurationMs}
              />
            </>
          )}
        </div>

        <aside className="flex min-h-0 flex-col gap-3">
          <Eyebrow as="h2" className="flex items-baseline justify-between">
            Zapisane
            <span className="font-mono">{references.length}</span>
          </Eyebrow>
          <div className="min-h-0 overflow-y-auto lg:max-h-[calc(100vh-220px)]">
            <ReferenceLibrary
              references={references}
              selectedId={selectedReferenceId}
              isLoading={isLoading}
              onLoad={handleLoad}
              onExport={exportReference}
              onDelete={deleteReference}
            />
          </div>
        </aside>
      </div>
    </section>
  )
}
