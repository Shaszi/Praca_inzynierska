import { useCallback, useState } from 'react'
import { ControlBar } from '../components/ControlBar'
import { DebugPanel } from '../components/DebugPanel'
import { DrawingCanvas } from '../components/DrawingCanvas'
import { ReferenceManager } from '../components/ReferenceManager'
import { TeacherStatusPanel } from '../components/TeacherStatusPanel'
import { useReferences } from '../hooks/useReferences'
import { useStrokes } from '../hooks/useStrokes'

export function TeacherPage() {
  const [brushSize, setBrushSize] = useState(5)

  const {
    strokes,
    strokeCount,
    currentStrokePointCount,
    lastStrokeDurationMs,
    setCurrentStrokePointCount,
    replaceStrokes,
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

  return (
    <section className="flex min-h-0 w-full flex-1 flex-col gap-4">
      <ControlBar
        brushSize={brushSize}
        onBrushSizeChange={setBrushSize}
        onUndo={undoStroke}
        onClear={clearStrokes}
      />

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
          onStrokeComplete={addStroke}
          onCurrentStrokePointCountChange={setCurrentStrokePointCount}
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
    </section>
  )
}
