import { useCallback, useEffect, useState } from 'react'
import { DebugPanel } from '../components/DebugPanel'
import { DrawingCanvas } from '../components/DrawingCanvas'
import { ReferenceManager } from '../components/ReferenceManager'
import { TeacherStatusPanel } from '../components/TeacherStatusPanel'
import { Toolbar } from '../components/Toolbar'
import { useReferences } from '../hooks/useReferences'
import { useStrokes } from '../hooks/useStrokes'
import type { Point, Tool } from '../types/drawing'
import { erasePointsFromStrokes } from '../utils/eraser'

export function TeacherPage() {
  const [brushSize, setBrushSize] = useState(8)
  const [tool, setTool] = useState<Tool>('brush')
  const [isFullscreen, setIsFullscreen] = useState(false)

  const {
    strokes,
    strokeCount,
    currentStrokePointCount,
    lastStrokeDurationMs,
    setCurrentStrokePointCount,
    replaceStrokes,
    transformStrokes,
    addStroke,
    undoStroke,
    clearStrokes,
  } = useStrokes()

  const {
    references,
    selectedReference,
    selectedReferenceId,
    setSelectedReferenceId,
    saveReference,
    loadReference,
    deleteReference,
    exportReference,
    importReference,
    statusMessage,
    errorMessage,
    isSaving,
    isImporting,
  } = useReferences()

  const handleSaveReference = useCallback(() => {
    saveReference(strokes)
  }, [saveReference, strokes])

  const handleLoadReference = useCallback(() => {
    const loadedStrokes = loadReference()
    if (loadedStrokes) {
      replaceStrokes(loadedStrokes)
    }
  }, [loadReference, replaceStrokes])

  const handleEraseAtPoint = useCallback(
    (point: Point) => {
      transformStrokes((previousStrokes) =>
        erasePointsFromStrokes(previousStrokes, point, brushSize),
      )
    },
    [brushSize, transformStrokes],
  )

  useEffect(() => {
    if (!isFullscreen) {
      return
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsFullscreen(false)
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isFullscreen])

  return (
    <section
      className={[
        'flex min-h-0 w-full flex-1 gap-4',
        isFullscreen ? 'fixed inset-0 z-50 bg-slate-100 p-4' : 'relative',
      ].join(' ')}
    >
      <Toolbar
        tool={tool}
        brushSize={brushSize}
        isFullscreen={isFullscreen}
        onToolChange={setTool}
        onBrushSizeChange={setBrushSize}
        onUndo={undoStroke}
        onClear={clearStrokes}
        onToggleFullscreen={() => setIsFullscreen((current) => !current)}
      />

      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <ReferenceManager
          references={references}
          selectedReferenceId={selectedReferenceId}
          onSelectReferenceId={setSelectedReferenceId}
          onSaveReference={handleSaveReference}
          onLoadReference={handleLoadReference}
          onDeleteReference={deleteReference}
          onExportReference={exportReference}
          onImportReference={importReference}
          isSaving={isSaving}
          isImporting={isImporting}
          hasSelectedReference={selectedReference !== null}
        />

        <div className="min-h-0 flex-1">
          <DrawingCanvas
            userStrokes={strokes}
            brushSize={brushSize}
            tool={tool}
            onStrokeComplete={addStroke}
            onEraseAtPoint={handleEraseAtPoint}
            onCurrentStrokePointCountChange={setCurrentStrokePointCount}
            showCursorPreview
          />
        </div>

        <DebugPanel
          strokeCount={strokeCount}
          currentStrokePointCount={currentStrokePointCount}
          lastStrokeDurationMs={lastStrokeDurationMs}
        />

        <TeacherStatusPanel
          statusMessage={statusMessage}
          errorMessage={errorMessage}
          referencesCount={references.length}
        />
      </div>
    </section>
  )
}