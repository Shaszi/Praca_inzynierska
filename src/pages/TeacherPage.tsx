import { useCallback, useEffect, useState } from "react";
import { DebugPanel } from "../components/DebugPanel";
import { DrawingCanvas } from "../features/canvas/components/DrawingCanvas";
import { ReferenceManager } from "../features/teacher/components/ReferenceManager";
import { TeacherStatusPanel } from "../features/teacher/components/TeacherStatusPanel";
import { Toolbar } from "../features/teacher/components/Toolbar";
import { useReferences } from "../features/teacher/hooks/useReferences";
import { useStrokes } from "../hooks/useStrokes";
import type { Point, Tool } from "../types/drawing";
import { eraseAtPoint } from "../utils/eraser";

export function TeacherPage() {
  const [brushSize, setBrushSize] = useState(8);
  const [tool, setTool] = useState<Tool>("brush");
  const [isCanvasFullscreen, setIsCanvasFullscreen] = useState(false);

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
  } = useStrokes();

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
  } = useReferences();

  const handleSaveReference = useCallback(() => {
    saveReference(strokes);
  }, [saveReference, strokes]);

  const handleLoadReference = useCallback(() => {
    const loadedStrokes = loadReference();
    if (loadedStrokes) {
      replaceStrokes(loadedStrokes);
    }
  }, [loadReference, replaceStrokes]);

  const handleEraseAtPoint = useCallback(
    (point: Point) => {
      eraseInSession((previousStrokes) =>
        eraseAtPoint(previousStrokes, point.x, point.y, brushSize),
      );
    },
    [brushSize, eraseInSession],
  );

  const handleUndo = useCallback(() => {
    undoStroke();
  }, [undoStroke]);

  const handleRedo = useCallback(() => {
    redoStroke();
  }, [redoStroke]);

  useEffect(() => {
    if (!isCanvasFullscreen) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsCanvasFullscreen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isCanvasFullscreen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMetaOrCtrl = event.metaKey || event.ctrlKey;
      if (!isMetaOrCtrl) return;

      const key = event.key.toLowerCase();
      const isUndo = key === "z" && !event.shiftKey;
      const isRedo = key === "y" || (key === "z" && event.shiftKey);

      if (isUndo && canUndo) {
        event.preventDefault();
        undoStroke();
      }

      if (isRedo && canRedo) {
        event.preventDefault();
        redoStroke();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canRedo, canUndo, redoStroke, undoStroke]);

  return (
    <section
      className={[
        "flex gap-4",
        isCanvasFullscreen
          ? "fixed inset-0 z-50 h-screen w-screen bg-slate-100 p-4"
          : "min-h-0 w-full flex-1",
      ].join(" ")}
    >
      <Toolbar
        tool={tool}
        brushSize={brushSize}
        isCanvasFullscreen={isCanvasFullscreen}
        onToolChange={setTool}
        onBrushSizeChange={setBrushSize}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onClear={clearStrokes}
        canUndo={canUndo}
        canRedo={canRedo}
        onToggleCanvasFullscreen={() =>
          setIsCanvasFullscreen((current) => !current)
        }
      />

      <div
        className={[
          "flex min-h-0 flex-1 flex-col",
          isCanvasFullscreen ? "w-full h-full" : "gap-4",
        ].join(" ")}
      >
        {!isCanvasFullscreen ? (
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
        ) : null}

        <div className={isCanvasFullscreen ? "min-h-0 flex-1 w-full h-full" : "min-h-0 flex-1"}>
          <DrawingCanvas
            userStrokes={strokes}
            brushSize={brushSize}
            tool={tool}
            onStrokeComplete={addStroke}
            onEraseStart={beginEraseSession}
            onEraseAtPoint={handleEraseAtPoint}
            onEraseEnd={endEraseSession}
            onCurrentStrokePointCountChange={setCurrentStrokePointCount}
            showCursorPreview
          />
        </div>

        {!isCanvasFullscreen ? (
          <DebugPanel
            strokeCount={strokeCount}
            currentStrokePointCount={currentStrokePointCount}
            lastStrokeDurationMs={lastStrokeDurationMs}
          />
        ) : null}

        {!isCanvasFullscreen ? (
          <TeacherStatusPanel
            statusMessage={statusMessage}
            errorMessage={errorMessage}
            referencesCount={references.length}
          />
        ) : null}
      </div>
    </section>
  );
}
