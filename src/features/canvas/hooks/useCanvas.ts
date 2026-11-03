import { useCallback, useEffect, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { Point, SmoothingSettings, Stroke, Tool } from "../../../types/drawing";
import { createStabilizer, DEFAULT_SMOOTHING, POINT_SPACING_PX, refineStroke, type Stabilizer } from "../smoothing";
import { renderCanvasScene } from "../utils/canvasDrawing";
import { createPointFromPointerEvent, getPointsFromPointerEvent } from "../utils/canvasPoint";

type UseCanvasOptions = {
  userStrokes: Stroke[];
  referenceStrokes?: Stroke[];
  brushSize: number;
  tool?: Tool;
  smoothing?: SmoothingSettings;
  userStrokeColor?: string;
  referenceStrokeColor?: string;
  /** rawPoints: pointer samples before stabilization/refinement — used to measure hand tremor. */
  onStrokeComplete: (stroke: Stroke, rawPoints: Point[]) => void;
  onEraseAtPoint?: (point: Point) => void;
  onEraseStart?: () => void;
  onEraseEnd?: () => void;
  onCurrentStrokePointCountChange?: (count: number) => void;
  onActiveStrokeChange?: (stroke: Stroke | null) => void;
};

type UseCanvasResult = {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onPointerDown: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
};

type CanvasMetrics = { width: number; height: number; dpr: number };

function getDistance(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function interpolatePoint(a: Point, b: Point, t: number): Point {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    timestamp: a.timestamp + (b.timestamp - a.timestamp) * t,
  };
}

function getSampledPointsBetween(a: Point, b: Point, spacing: number): Point[] {
  const distance = getDistance(a, b);
  if (distance === 0) return [];
  const sampledPoints: Point[] = [];
  const segments = Math.max(1, Math.ceil(distance / spacing));
  for (let step = 1; step <= segments; step += 1) {
    sampledPoints.push(interpolatePoint(a, b, step / segments));
  }
  return sampledPoints;
}

// Appends `point`, filling the gap with evenly spaced samples so strokes keep a uniform density
function appendPoint(points: Point[], point: Point): void {
  const prev = points[points.length - 1];
  if (!prev) {
    points.push(point);
    return;
  }
  for (const p of getSampledPointsBetween(prev, point, POINT_SPACING_PX)) points.push(p);
}

export function useCanvas({
  userStrokes,
  referenceStrokes = [],
  brushSize,
  tool = "brush",
  smoothing = DEFAULT_SMOOTHING,
  userStrokeColor = "#16181d",
  referenceStrokeColor = "#c4cad3",
  onStrokeComplete,
  onEraseAtPoint,
  onEraseStart,
  onEraseEnd,
  onCurrentStrokePointCountChange,
  onActiveStrokeChange,
}: UseCanvasOptions): UseCanvasResult {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const metricsRef = useRef<CanvasMetrics>({ width: 0, height: 0, dpr: 1 });
  const activePointsRef = useRef<Point[]>([]);
  const rawPointsRef = useRef<Point[]>([]);
  const activeBrushSizeRef = useRef(brushSize);
  const lastPointerPointRef = useRef<Point | null>(null);
  const isPointerActiveRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const stabilizerRef = useRef<Stabilizer | null>(null);

  // Keep stable refs to props that change — avoids stale closures in callbacks
  const userStrokesRef = useRef(userStrokes);
  const referenceStrokesRef = useRef(referenceStrokes);
  const userStrokeColorRef = useRef(userStrokeColor);
  const referenceStrokeColorRef = useRef(referenceStrokeColor);
  const toolRef = useRef(tool);
  const smoothingRef = useRef(smoothing);

  useEffect(() => { userStrokesRef.current = userStrokes; }, [userStrokes]);
  useEffect(() => { referenceStrokesRef.current = referenceStrokes; }, [referenceStrokes]);
  useEffect(() => { userStrokeColorRef.current = userStrokeColor; }, [userStrokeColor]);
  useEffect(() => { referenceStrokeColorRef.current = referenceStrokeColor; }, [referenceStrokeColor]);
  useEffect(() => { toolRef.current = tool; }, [tool]);
  useEffect(() => { smoothingRef.current = smoothing; }, [smoothing]);

  const redrawScene = useCallback(() => {
    const canvas = canvasRef.current;
    const metrics = metricsRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const activeStroke =
      toolRef.current === "brush" && activePointsRef.current.length > 0
        ? { points: activePointsRef.current, brushSize: activeBrushSizeRef.current }
        : null;

    renderCanvasScene({
      context,
      width: metrics.width,
      height: metrics.height,
      dpr: metrics.dpr,
      referenceStrokes: referenceStrokesRef.current,
      userStrokes: userStrokesRef.current,
      activeStroke,
      referenceStrokeColor: referenceStrokeColorRef.current,
      userStrokeColor: userStrokeColorRef.current,
    });
  }, []);

  // Cap renders to one per animation frame regardless of pointer event rate
  const scheduleRedraw = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      redrawScene();
    });
  }, [redrawScene]);

  const resizeCanvas = useCallback(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);
    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    metricsRef.current = { width, height, dpr };
    redrawScene();
  }, [redrawScene]);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      event.preventDefault();
      canvas.setPointerCapture(event.pointerId);
      isPointerActiveRef.current = true;

      const point = createPointFromPointerEvent(event.nativeEvent, canvas.getBoundingClientRect());
      if (tool === "eraser") {
        onEraseStart?.();
        lastPointerPointRef.current = point;
        onEraseAtPoint?.(point);
        return;
      }

      // Settings are captured per stroke, so changing them mid-stroke has no effect
      stabilizerRef.current = createStabilizer(smoothingRef.current);
      activeBrushSizeRef.current = brushSize;
      activePointsRef.current = [stabilizerRef.current.push(point) ?? point];
      rawPointsRef.current = [point];
      lastPointerPointRef.current = point;
      onCurrentStrokePointCountChange?.(1);
      onActiveStrokeChange?.({ points: [{ ...point }], brushSize: activeBrushSizeRef.current });
      scheduleRedraw();
    },
    [brushSize, onActiveStrokeChange, onCurrentStrokePointCountChange, onEraseAtPoint, onEraseStart, scheduleRedraw, tool],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!isPointerActiveRef.current || !canvasRef.current) return;

      const rawPoints = getPointsFromPointerEvent(event, canvasRef.current);
      if (tool === "eraser") {
        for (const point of rawPoints) {
          const last = lastPointerPointRef.current;
          const sampled = last ? getSampledPointsBetween(last, point, POINT_SPACING_PX) : [point];
          for (const p of sampled) onEraseAtPoint?.(p);
          lastPointerPointRef.current = point;
        }
        return;
      }

      const points = activePointsRef.current;
      const countBefore = points.length;
      for (const point of rawPoints) {
        lastPointerPointRef.current = point;
        rawPointsRef.current.push(point);
        const stabilized = stabilizerRef.current ? stabilizerRef.current.push(point) : point;
        if (stabilized) appendPoint(points, stabilized);
      }
      if (points.length === countBefore) return;

      onCurrentStrokePointCountChange?.(points.length);
      onActiveStrokeChange?.({ points: points.map((p) => ({ ...p })), brushSize: activeBrushSizeRef.current });
      scheduleRedraw();
    },
    [onActiveStrokeChange, onCurrentStrokePointCountChange, onEraseAtPoint, scheduleRedraw, tool],
  );

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!isPointerActiveRef.current) return;

      const canvas = canvasRef.current;
      if (canvas?.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      isPointerActiveRef.current = false;

      if (tool === "brush" && activePointsRef.current.length > 0) {
        const points = activePointsRef.current;
        const tail = stabilizerRef.current?.finish();
        if (tail) appendPoint(points, tail);

        onStrokeComplete({
          points: refineStroke(points, smoothingRef.current).map((p) => ({ ...p })),
          brushSize: activeBrushSizeRef.current,
        }, rawPointsRef.current);
      }
      stabilizerRef.current = null;
      if (tool === "eraser") onEraseEnd?.();

      activePointsRef.current = [];
      rawPointsRef.current = [];
      lastPointerPointRef.current = null;
      onCurrentStrokePointCountChange?.(0);
      onActiveStrokeChange?.(null);
      scheduleRedraw();
    },
    [onActiveStrokeChange, onCurrentStrokePointCountChange, onEraseEnd, onStrokeComplete, scheduleRedraw, tool],
  );

  // Re-render whenever strokes or colors change (e.g. eraser, undo, new stroke)
  useEffect(() => {
    scheduleRedraw();
  }, [userStrokes, referenceStrokes, userStrokeColor, referenceStrokeColor, scheduleRedraw]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(container);
    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", resizeCanvas);
      // Reset the ref too — otherwise scheduleRedraw() would think a frame is still pending
      // and never draw again (happens on StrictMode's mount → unmount → mount)
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [resizeCanvas]);

  return { canvasRef, containerRef, onPointerDown, onPointerMove, onPointerUp };
}
