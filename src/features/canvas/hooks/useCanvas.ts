import { useCallback, useEffect, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { Point, Stroke, Tool } from "../../../types/drawing";
import { renderCanvasScene } from "../utils/canvasDrawing";
import { createPointFromPointerEvent } from "../utils/canvasPoint";

type UseCanvasOptions = {
  userStrokes: Stroke[];
  referenceStrokes?: Stroke[];
  brushSize: number;
  tool?: Tool;
  userStrokeColor?: string;
  referenceStrokeColor?: string;
  onStrokeComplete: (stroke: Stroke) => void;
  onEraseAtPoint?: (point: Point) => void;
  onEraseStart?: () => void;
  onEraseEnd?: () => void;
  onCurrentStrokePointCountChange?: (count: number) => void;
};

type UseCanvasResult = {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onPointerDown: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
};

type CanvasMetrics = { width: number; height: number; dpr: number };
const POINT_SPACING_PX = 3;

function getDistance(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function interpolatePoint(a: Point, b: Point, t: number): Point {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    timestamp: Math.round(a.timestamp + (b.timestamp - a.timestamp) * t),
  };
}

function getSampledPointsBetween(a: Point, b: Point, spacing: number): Point[] {
  const distance = getDistance(a, b);
  if (distance === 0) {
    return [];
  }

  const sampledPoints: Point[] = [];
  const segments = Math.max(1, Math.ceil(distance / spacing));
  for (let step = 1; step <= segments; step += 1) {
    sampledPoints.push(interpolatePoint(a, b, step / segments));
  }

  return sampledPoints;
}

export function useCanvas({
  userStrokes,
  referenceStrokes = [],
  brushSize,
  tool = "brush",
  userStrokeColor = "#1f2937",
  referenceStrokeColor = "#cbd5e1",
  onStrokeComplete,
  onEraseAtPoint,
  onEraseStart,
  onEraseEnd,
  onCurrentStrokePointCountChange,
}: UseCanvasOptions): UseCanvasResult {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const metricsRef = useRef<CanvasMetrics>({ width: 0, height: 0, dpr: 1 });
  const activePointsRef = useRef<Point[]>([]);
  const activeBrushSizeRef = useRef(brushSize);
  const lastPointerPointRef = useRef<Point | null>(null);
  const isPointerActiveRef = useRef(false);

  const redrawScene = useCallback(() => {
    const canvas = canvasRef.current;
    const metrics = metricsRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const activeStroke =
      tool === "brush" && activePointsRef.current.length > 0
        ? {
            points: activePointsRef.current,
            brushSize: activeBrushSizeRef.current,
          }
        : null;

    renderCanvasScene({
      context,
      width: metrics.width,
      height: metrics.height,
      dpr: metrics.dpr,
      referenceStrokes,
      userStrokes,
      activeStroke,
      referenceStrokeColor,
      userStrokeColor,
    });
  }, [
    referenceStrokeColor,
    referenceStrokes,
    tool,
    userStrokeColor,
    userStrokes,
  ]);

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

      const point = createPointFromPointerEvent(event, canvas);
      if (tool === "eraser") {
        onEraseStart?.();
        lastPointerPointRef.current = point;
        onEraseAtPoint?.(point);
        return;
      }

      activeBrushSizeRef.current = brushSize;
      activePointsRef.current = [point];
      lastPointerPointRef.current = point;
      onCurrentStrokePointCountChange?.(1);
      redrawScene();
    },
    [
      brushSize,
      onCurrentStrokePointCountChange,
      onEraseAtPoint,
      onEraseStart,
      redrawScene,
      tool,
    ],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!isPointerActiveRef.current || !canvasRef.current) return;

      const point = createPointFromPointerEvent(event, canvasRef.current);
      if (tool === "eraser") {
        const lastPointerPoint = lastPointerPointRef.current;
        if (!lastPointerPoint) {
          onEraseAtPoint?.(point);
          lastPointerPointRef.current = point;
          return;
        }

        const sampledPoints = getSampledPointsBetween(
          lastPointerPoint,
          point,
          POINT_SPACING_PX,
        );
        for (const sampledPoint of sampledPoints) {
          onEraseAtPoint?.(sampledPoint);
        }
        lastPointerPointRef.current = point;
        return;
      }

      const points = activePointsRef.current;
      const previousPoint = points[points.length - 1];
      if (previousPoint?.x === point.x && previousPoint.y === point.y) return;

      const sampledPoints = getSampledPointsBetween(
        previousPoint,
        point,
        POINT_SPACING_PX,
      );
      for (const sampledPoint of sampledPoints) {
        points.push(sampledPoint);
      }
      lastPointerPointRef.current = point;
      onCurrentStrokePointCountChange?.(points.length);
      redrawScene();
    },
    [onCurrentStrokePointCountChange, onEraseAtPoint, redrawScene, tool],
  );

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!isPointerActiveRef.current) return;

      const canvas = canvasRef.current;
      if (canvas?.hasPointerCapture(event.pointerId))
        canvas.releasePointerCapture(event.pointerId);
      isPointerActiveRef.current = false;

      if (tool === "brush" && activePointsRef.current.length > 0) {
        onStrokeComplete({
          points: activePointsRef.current.map((point) => ({ ...point })),
          brushSize: activeBrushSizeRef.current,
        });
      }
      if (tool === "eraser") {
        onEraseEnd?.();
      }

      activePointsRef.current = [];
      lastPointerPointRef.current = null;
      onCurrentStrokePointCountChange?.(0);
      redrawScene();
    },
    [
      onCurrentStrokePointCountChange,
      onEraseEnd,
      onStrokeComplete,
      redrawScene,
      tool,
    ],
  );

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
    };
  }, [resizeCanvas]);

  useEffect(() => redrawScene(), [redrawScene]);

  return { canvasRef, containerRef, onPointerDown, onPointerMove, onPointerUp };
}
