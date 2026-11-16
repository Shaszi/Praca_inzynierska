import { useCallback, useEffect, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { Layer, Point, SmoothingSettings, Stroke, Tool } from "../../../types/drawing";
import { createStabilizer, DEFAULT_SMOOTHING, POINT_SPACING_PX, refineStroke, type Stabilizer } from "../smoothing";
import { renderCanvasScene, replayLayer } from "../utils/canvasDrawing";
import {
  createPointFromPointerEvent,
  fitView,
  getPointsFromPointerEvent,
  IDENTITY_VIEW,
  lerpView,
  revealView,
  strokesBounds,
  type Bounds,
  type CanvasView,
} from "../utils/canvasPoint";

type UseCanvasOptions = {
  layers: Layer[];
  referenceStrokes?: Stroke[];
  brushSize: number;
  brushOpacity?: number;
  tool?: Tool;
  smoothing?: SmoothingSettings;
  userStrokeColor?: string;
  referenceStrokeColor?: string;
  onStrokeComplete: (stroke: Stroke, rawPoints: Point[]) => void;
  onEraseAtPoint?: (point: Point) => void;
  onEraseStart?: () => void;
  onEraseEnd?: () => void;
  onCurrentStrokePointCountChange?: (count: number) => void;
  onActiveStrokeChange?: (stroke: Stroke | null) => void;
  onViewChange?: (view: CanvasView) => void;
  fitBounds?: Bounds | null;
};

type UseCanvasResult = {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onPointerDown: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
};

type CanvasMetrics = { width: number; height: number; dpr: number };

function sameBounds(a: Bounds | null, b: Bounds | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.minX === b.minX && a.minY === b.minY && a.maxX === b.maxX && a.maxY === b.maxY;
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 6;
const REVEAL_MS = 450;
const FIT_PADDING = 28;
const REFIT_SIZE_CHANGE = 0.25;
const GUIDE_DASH_SPEED = 26;

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

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

export function withLiveTip(points: Point[], raw: Point | null): Point[] {
  if (!raw || points.length === 0) return points
  const last = points[points.length - 1]
  if (getDistance(last, raw) < 0.5) return points
  return [...points, raw]
}

function appendPoint(points: Point[], point: Point): void {
  const prev = points[points.length - 1];
  if (!prev) {
    points.push(point);
    return;
  }
  for (const p of getSampledPointsBetween(prev, point, POINT_SPACING_PX)) points.push(p);
}

export function useCanvas({
  layers,
  referenceStrokes = [],
  brushSize,
  brushOpacity = 1,
  tool = "brush",
  smoothing = DEFAULT_SMOOTHING,
  userStrokeColor = "#16132a",
  referenceStrokeColor = "#c6c1e3",
  onStrokeComplete,
  onEraseAtPoint,
  onEraseStart,
  onEraseEnd,
  onCurrentStrokePointCountChange,
  onActiveStrokeChange,
  onViewChange,
  fitBounds = null,
}: UseCanvasOptions): UseCanvasResult {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const metricsRef = useRef<CanvasMetrics>({ width: 0, height: 0, dpr: 1 });
  const activePointsRef = useRef<Point[]>([]);
  const rawPointsRef = useRef<Point[]>([]);
  const activeBrushSizeRef = useRef(brushSize);
  const activeColorRef = useRef(userStrokeColor);
  const activeOpacityRef = useRef(brushOpacity);
  const lastPointerPointRef = useRef<Point | null>(null);
  const isPointerActiveRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const stabilizerRef = useRef<Stabilizer | null>(null);
  // Canvasy warstw żyją w refie, nigdy w obiektach Layer — structuredClone w useHistory rzuca na elemencie canvas.
  const layerCanvasesRef = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const layersDirtyRef = useRef(true);
  const viewRef = useRef<CanvasView>(IDENTITY_VIEW);
  const fitBoundsRef = useRef<Bounds | null>(fitBounds);
  const userAdjustedViewRef = useRef(false);
  const fittedSizeRef = useRef<{ width: number; height: number } | null>(null);
  const revealRafRef = useRef<number | null>(null);
  const cancelReveal = useCallback(() => {
    if (revealRafRef.current === null) return;
    cancelAnimationFrame(revealRafRef.current);
    revealRafRef.current = null;
  }, []);
  const panRef = useRef<{ pointerId: number; startX: number; startY: number; origin: CanvasView } | null>(null);
  const touchesRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const gestureRef = useRef<{ distance: number; midX: number; midY: number; origin: CanvasView } | null>(null);
  const guidePhaseRef = useRef(0);
  const guideRafRef = useRef<number | null>(null);

  const layersRef = useRef(layers);
  const referenceStrokesRef = useRef(referenceStrokes);
  const userStrokeColorRef = useRef(userStrokeColor);
  const referenceStrokeColorRef = useRef(referenceStrokeColor);
  const toolRef = useRef(tool);
  const smoothingRef = useRef(smoothing);

  useEffect(() => { layersRef.current = layers; layersDirtyRef.current = true; }, [layers]);
  useEffect(() => { referenceStrokesRef.current = referenceStrokes; }, [referenceStrokes]);
  useEffect(() => { userStrokeColorRef.current = userStrokeColor; layersDirtyRef.current = true; }, [userStrokeColor]);
  useEffect(() => { referenceStrokeColorRef.current = referenceStrokeColor; }, [referenceStrokeColor]);
  useEffect(() => { toolRef.current = tool; }, [tool]);
  useEffect(() => { smoothingRef.current = smoothing; }, [smoothing]);

  const getLayers = useCallback((): Layer[] => layersRef.current, []);

  // shortcut: pełne odtworzenie warstwy przy każdej zmianie kresek, zamiast dorysowania
  // tylko nowej. Jest to raz na kreskę, nie raz na klatkę jak dotąd. Podnieść, gdy
  // rysunki przekroczą kilkaset kresek i zatwierdzanie zacznie być odczuwalne.
  const rebuildLayers = useCallback((layers: Layer[]) => {
    const metrics = metricsRef.current;
    const deviceWidth = Math.max(1, Math.floor(metrics.width * metrics.dpr));
    const deviceHeight = Math.max(1, Math.floor(metrics.height * metrics.dpr));
    const canvases = layerCanvasesRef.current;

    for (const layer of layers) {
      let target = canvases.get(layer.id);
      if (!target) {
        target = document.createElement("canvas");
        canvases.set(layer.id, target);
      }
      if (target.width !== deviceWidth || target.height !== deviceHeight) {
        target.width = deviceWidth;
        target.height = deviceHeight;
      }
      const layerContext = target.getContext("2d");
      if (!layerContext) continue;

      replayLayer(layerContext, layer, {
        color: userStrokeColorRef.current,
        dpr: metrics.dpr,
        width: metrics.width,
        height: metrics.height,
        view: viewRef.current,
      });
    }

    const liveIds = new Set(layers.map((layer) => layer.id));
    for (const id of [...canvases.keys()]) {
      if (!liveIds.has(id)) canvases.delete(id);
    }
  }, []);

  const redrawScene = useCallback(() => {
    const canvas = canvasRef.current;
    const metrics = metricsRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const activeStroke =
      toolRef.current === "brush" && activePointsRef.current.length > 0
        ? {
            points: withLiveTip(activePointsRef.current, lastPointerPointRef.current),
            brushSize: activeBrushSizeRef.current,
            color: activeColorRef.current,
            opacity: activeOpacityRef.current,
          }
        : null;

    const layers = getLayers();
    if (layersDirtyRef.current) {
      rebuildLayers(layers);
      layersDirtyRef.current = false;
    }

    renderCanvasScene({
      context,
      width: metrics.width,
      height: metrics.height,
      dpr: metrics.dpr,
      referenceStrokes: referenceStrokesRef.current,
      layers,
      layerCanvases: layerCanvasesRef.current,
      activeStroke,
      referenceStrokeColor: referenceStrokeColorRef.current,
      userStrokeColor: userStrokeColorRef.current,
      view: viewRef.current,
      guideDashOffset: guidePhaseRef.current,
    });
  }, [getLayers, rebuildLayers]);

  const scheduleRedraw = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      redrawScene();
    });
  }, [redrawScene]);

  const baseView = useCallback((): CanvasView => {
    const metrics = metricsRef.current;
    return fitView(fitBoundsRef.current, metrics.width, metrics.height, FIT_PADDING, {
      min: MIN_SCALE,
      max: MAX_SCALE,
    });
  }, []);

  const zoomAt = useCallback(
    (screenX: number, screenY: number, factor: number) => {
      cancelReveal();
      const current = viewRef.current;
      const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, current.scale * factor));
      if (nextScale === current.scale) return;

      const base = baseView();
      if (Math.abs(nextScale - base.scale) < 0.06 * base.scale) {
        viewRef.current = base;
      } else {
        const drawingX = (screenX - current.offsetX) / current.scale;
        const drawingY = (screenY - current.offsetY) / current.scale;

        viewRef.current = {
          scale: nextScale,
          offsetX: screenX - drawingX * nextScale,
          offsetY: screenY - drawingY * nextScale,
        };
      }

      userAdjustedViewRef.current = viewRef.current !== base;
      layersDirtyRef.current = true;
      onViewChange?.(viewRef.current);
      scheduleRedraw();
    },
    [baseView, cancelReveal, onViewChange, scheduleRedraw],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (event: WheelEvent) => {
      // Bez preventDefault strona przewija się pod płótnem. React rejestruje wheel
      // pasywnie, dlatego nasłuch jest natywny z passive: false.
      event.preventDefault();
      const bounds = canvas.getBoundingClientRect();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? bounds.height : 1;
      const delta = event.deltaY * unit;
      zoomAt(event.clientX - bounds.left, event.clientY - bounds.top, Math.exp(-delta * 0.0015));
    };

    // Windows otwiera autoprzewijanie na środkowym przycisku — blokujemy je,
    // inaczej przesuwanie płótna walczy z przewijaniem strony.
    const blockAux = (event: MouseEvent) => {
      if (event.button === 1 || event.button === 2) event.preventDefault();
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("mousedown", blockAux);
    canvas.addEventListener("auxclick", blockAux);
    return () => {
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("mousedown", blockAux);
      canvas.removeEventListener("auxclick", blockAux);
    };
  }, [zoomAt]);

  const resizeCanvas = useCallback((refit = false) => {
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
    const fitted = fittedSizeRef.current;
    const changedALot =
      !fitted ||
      Math.abs(width - fitted.width) / Math.max(fitted.width, 1) > REFIT_SIZE_CHANGE ||
      Math.abs(height - fitted.height) / Math.max(fitted.height, 1) > REFIT_SIZE_CHANGE;

    if (refit && fitBoundsRef.current && !userAdjustedViewRef.current && changedALot && !isPointerActiveRef.current) {
      fittedSizeRef.current = { width, height };
      viewRef.current = baseView();
      onViewChange?.(viewRef.current);
    }
    layersDirtyRef.current = true;
    redrawScene();
  }, [baseView, onViewChange, redrawScene]);

  const readPinch = useCallback(() => {
    const [a, b] = [...touchesRef.current.values()];
    if (!a || !b) return null;
    return { midX: (a.x + b.x) / 2, midY: (a.y + b.y) / 2, distance: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)) };
  }, []);

  const cancelActiveStroke = useCallback(() => {
    if (!isPointerActiveRef.current) return;
    isPointerActiveRef.current = false;
    activePointsRef.current = [];
    rawPointsRef.current = [];
    stabilizerRef.current = null;
    lastPointerPointRef.current = null;
    onCurrentStrokePointCountChange?.(0);
    onActiveStrokeChange?.(null);
    onEraseEnd?.();
    scheduleRedraw();
  }, [onActiveStrokeChange, onCurrentStrokePointCountChange, onEraseEnd, scheduleRedraw]);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      event.preventDefault();
      cancelReveal();

      if (event.pointerType === "touch") {
        const bounds = canvas.getBoundingClientRect();
        touchesRef.current.set(event.pointerId, { x: event.clientX - bounds.left, y: event.clientY - bounds.top });
        if (touchesRef.current.size >= 2) {
          cancelActiveStroke();
          const pinch = readPinch();
          if (pinch) gestureRef.current = { ...pinch, origin: viewRef.current };
          return;
        }
      }

      if (event.button === 1 || event.button === 2) {
        canvas.setPointerCapture(event.pointerId);
        panRef.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          origin: viewRef.current,
        };
        canvas.style.cursor = "grabbing";
        return;
      }

      canvas.setPointerCapture(event.pointerId);
      isPointerActiveRef.current = true;

      const point = createPointFromPointerEvent(event.nativeEvent, canvas.getBoundingClientRect(), viewRef.current);
      if (tool === "eraser") {
        onEraseStart?.();
        lastPointerPointRef.current = point;
        onEraseAtPoint?.(point);
        return;
      }

      stabilizerRef.current = createStabilizer(smoothingRef.current);
      activeBrushSizeRef.current = brushSize;
      activeColorRef.current = userStrokeColorRef.current;
      activeOpacityRef.current = brushOpacity;
      activePointsRef.current = [stabilizerRef.current.push(point) ?? point];
      rawPointsRef.current = [point];
      lastPointerPointRef.current = point;
      onCurrentStrokePointCountChange?.(1);
      onActiveStrokeChange?.({
        points: [{ ...point }],
        brushSize: activeBrushSizeRef.current,
        color: activeColorRef.current,
        opacity: activeOpacityRef.current,
      });
      scheduleRedraw();
    },
    [brushOpacity, brushSize, cancelActiveStroke, cancelReveal, onActiveStrokeChange, onCurrentStrokePointCountChange, onEraseAtPoint, onEraseStart, readPinch, scheduleRedraw, tool],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (event.pointerType === "touch" && touchesRef.current.has(event.pointerId)) {
        const canvas = canvasRef.current;
        const bounds = canvas?.getBoundingClientRect();
        if (bounds) {
          touchesRef.current.set(event.pointerId, { x: event.clientX - bounds.left, y: event.clientY - bounds.top });
        }
        const gesture = gestureRef.current;
        const pinch = gesture && touchesRef.current.size >= 2 ? readPinch() : null;
        if (gesture && pinch) {
          const factor = pinch.distance / gesture.distance;
          const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, gesture.origin.scale * factor));
          const anchorX = (gesture.midX - gesture.origin.offsetX) / gesture.origin.scale;
          const anchorY = (gesture.midY - gesture.origin.offsetY) / gesture.origin.scale;
          viewRef.current = {
            scale,
            offsetX: pinch.midX - anchorX * scale,
            offsetY: pinch.midY - anchorY * scale,
          };
          userAdjustedViewRef.current = true;
          layersDirtyRef.current = true;
          onViewChange?.(viewRef.current);
          scheduleRedraw();
          return;
        }
      }

      const pan = panRef.current;
      if (pan && pan.pointerId === event.pointerId) {
        viewRef.current = {
          scale: pan.origin.scale,
          offsetX: pan.origin.offsetX + (event.clientX - pan.startX),
          offsetY: pan.origin.offsetY + (event.clientY - pan.startY),
        };
        userAdjustedViewRef.current = true;
        // shortcut: pełny replay warstw na każdą klatkę przesuwania. Przy kilkuset
        // kreskach zacznie zacinać — wtedy składać bitmapy z przesunięciem zamiast
        // rasteryzować je od nowa, bo samo przesunięcie nie zmienia skali.
        layersDirtyRef.current = true;
        onViewChange?.(viewRef.current);
        scheduleRedraw();
        return;
      }

      if (!isPointerActiveRef.current || !canvasRef.current) return;

      const rawPoints = getPointsFromPointerEvent(event, canvasRef.current, viewRef.current);
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
      onActiveStrokeChange?.({
        points: points.map((p) => ({ ...p })),
        brushSize: activeBrushSizeRef.current,
        color: activeColorRef.current,
        opacity: activeOpacityRef.current,
      });
      scheduleRedraw();
    },
    [onActiveStrokeChange, onCurrentStrokePointCountChange, onEraseAtPoint, onViewChange, readPinch, scheduleRedraw, tool],
  );

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;

      if (event.pointerType === "touch" && touchesRef.current.delete(event.pointerId)) {
        if (touchesRef.current.size < 2) gestureRef.current = null;
        if (!isPointerActiveRef.current) return;
      }

      const pan = panRef.current;
      if (pan && pan.pointerId === event.pointerId) {
        if (canvas?.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
        panRef.current = null;
        if (canvas) canvas.style.cursor = "";
        return;
      }

      if (!isPointerActiveRef.current) return;

      if (canvas?.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      isPointerActiveRef.current = false;

      if (tool === "brush" && activePointsRef.current.length > 0) {
        const points = activePointsRef.current;
        const tail = stabilizerRef.current?.finish();
        if (tail) appendPoint(points, tail);

        onStrokeComplete({
          points: refineStroke(points, smoothingRef.current).map((p) => ({ ...p })),
          brushSize: activeBrushSizeRef.current,
          color: activeColorRef.current,
          opacity: activeOpacityRef.current,
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

  useEffect(() => {
    scheduleRedraw();
  }, [layers, referenceStrokes, userStrokeColor, referenceStrokeColor, scheduleRedraw]);

  useEffect(() => {
    if (referenceStrokes.length === 0 || prefersReducedMotion()) {
      guidePhaseRef.current = 0;
      return;
    }

    let previous = performance.now();
    const tick = (now: number) => {
      const elapsed = now - previous;
      previous = now;
      if (!isPointerActiveRef.current) {
        guidePhaseRef.current = (guidePhaseRef.current + (GUIDE_DASH_SPEED * elapsed) / 1000) % 20;
        redrawScene();
      }
      guideRafRef.current = requestAnimationFrame(tick);
    };
    guideRafRef.current = requestAnimationFrame(tick);

    return () => {
      if (guideRafRef.current !== null) {
        cancelAnimationFrame(guideRafRef.current);
        guideRafRef.current = null;
      }
    };
  }, [redrawScene, referenceStrokes]);

  // Nowy krok: gdy jego linia wystaje poza kadr, kadr płynnie do niej dojeżdża (przesunięcie,
  // a gdy linia się nie mieści — oddalenie). Klucz to obrys linii, nie tablica: wywołujący
  // podaje nową tablicę co render, a wtedy każdy render ściągałby kadr z powrotem do linii.
  const guideBounds = strokesBounds(referenceStrokes);
  const revealKey = guideBounds
    ? `${guideBounds.minX},${guideBounds.minY},${guideBounds.maxX},${guideBounds.maxY}`
    : "";
  useEffect(() => {
    const bounds = strokesBounds(referenceStrokesRef.current);
    const { width, height } = metricsRef.current;
    if (!bounds || width === 0 || height === 0 || isPointerActiveRef.current) return;
    const from = viewRef.current;
    const to = revealView(from, bounds, width, height, FIT_PADDING, { min: MIN_SCALE, max: MAX_SCALE });
    if (!to) return;

    cancelReveal();
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const start = performance.now();
    const tick = (now: number) => {
      const t = reduceMotion ? 1 : Math.min(1, (now - start) / REVEAL_MS);
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      viewRef.current = lerpView(from, to, eased, width, height);
      layersDirtyRef.current = true;
      onViewChange?.(viewRef.current);
      scheduleRedraw();
      revealRafRef.current = t < 1 ? requestAnimationFrame(tick) : null;
    };
    revealRafRef.current = requestAnimationFrame(tick);
    return cancelReveal;
  }, [revealKey, cancelReveal, onViewChange, scheduleRedraw]);

  // Nowy wzorzec = nowy obrys do wpisania w kadr. Porównanie po wartościach, nie po
  // tożsamości: wywołujący, który liczy obrys w JSX, dawałby nowy obiekt co render,
  // a wtedy każdy render kasowałby przybliżenie i kreska w ruchu skakałaby po kadrze.
  useEffect(() => {
    if (sameBounds(fitBoundsRef.current, fitBounds)) return;
    fitBoundsRef.current = fitBounds;
    userAdjustedViewRef.current = false;
    fittedSizeRef.current = { ...metricsRef.current };
    viewRef.current = baseView();
    onViewChange?.(viewRef.current);
    layersDirtyRef.current = true;
    scheduleRedraw();
  }, [baseView, fitBounds, onViewChange, scheduleRedraw]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Obserwator pilnuje tylko bitmapy; o ponownym dopasowaniu decyduje zmiana okna.
    const observer = new ResizeObserver(() => resizeCanvas(false));
    observer.observe(container);
    const onWindowResize = () => resizeCanvas(true);
    window.addEventListener("resize", onWindowResize);
    window.addEventListener("orientationchange", onWindowResize);
    resizeCanvas(true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", onWindowResize);
      window.removeEventListener("orientationchange", onWindowResize);
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
