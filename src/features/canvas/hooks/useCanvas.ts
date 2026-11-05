import { useCallback, useEffect, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { Layer, Point, SmoothingSettings, Stroke, Tool } from "../../../types/drawing";
import { createStabilizer, DEFAULT_SMOOTHING, POINT_SPACING_PX, refineStroke, type Stabilizer } from "../smoothing";
import { renderCanvasScene, replayLayer } from "../utils/canvasDrawing";
import { createPointFromPointerEvent, getPointsFromPointerEvent, IDENTITY_VIEW, type CanvasView } from "../utils/canvasPoint";

type UseCanvasOptions = {
  layers: Layer[];
  referenceStrokes?: Stroke[];
  brushSize: number;
  /** Krycie pędzla 0–1, zapisywane na kresce. */
  brushOpacity?: number;
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
  /** Zmiana przybliżenia. Rzadka (tyknięcia kółka), więc wolno ją trzymać w stanie Reacta. */
  onViewChange?: (view: CanvasView) => void;
};

type UseCanvasResult = {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onPointerDown: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
};

type CanvasMetrics = { width: number; height: number; dpr: number };


const MIN_SCALE = 0.5;
const MAX_SCALE = 6;
// Prędkość wędrowania kreskowania wzorca, w pikselach rysunku na sekundę.
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

/**
 * Dociąga rysowaną kreskę do prawdziwej pozycji wskaźnika.
 *
 * Stabilizator z definicji zostaje za kursorem (filtr One Euro wygładza, tryb „rope"
 * trzyma punkt w promieniu), a na puszczeniu dokleja zaległy punkt — stąd wrażenie,
 * że linia wlecze się za myszką i na końcu przeskakuje. Do RYSOWANIA pokazujemy
 * czubek w miejscu kursora; zapisywane punkty zostają filtrowane, więc ocena kreski
 * nic nie traci.
 */
export function withLiveTip(points: Point[], raw: Point | null): Point[] {
  if (!raw || points.length === 0) return points
  const last = points[points.length - 1]
  if (getDistance(last, raw) < 0.5) return points
  return [...points, raw]
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
  layers,
  referenceStrokes = [],
  brushSize,
  brushOpacity = 1,
  tool = "brush",
  smoothing = DEFAULT_SMOOTHING,
  // Hexy literalne, bo context 2D nie przyjmie klas — odpowiadają --color-ink i --color-line-strong.
  userStrokeColor = "#16132a",
  referenceStrokeColor = "#c6c1e3",
  onStrokeComplete,
  onEraseAtPoint,
  onEraseStart,
  onEraseEnd,
  onCurrentStrokePointCountChange,
  onActiveStrokeChange,
  onViewChange,
}: UseCanvasOptions): UseCanvasResult {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const metricsRef = useRef<CanvasMetrics>({ width: 0, height: 0, dpr: 1 });
  const activePointsRef = useRef<Point[]>([]);
  const rawPointsRef = useRef<Point[]>([]);
  const activeBrushSizeRef = useRef(brushSize);
  // Kolor i krycie zamrażane na starcie kreski, tak jak grubość — zmiana pędzla
  // w trakcie nie może przemalować tego, co już narysowane.
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
  // Przesuwanie płótna: środkowy przycisk albo prawy. Zapamiętujemy widok z chwili
  // startu, żeby liczyć przesunięcie od niego, a nie kumulować błędu z klatek.
  const panRef = useRef<{ pointerId: number; startX: number; startY: number; origin: CanvasView } | null>(null);
  const guidePhaseRef = useRef(0);
  const guideRafRef = useRef<number | null>(null);

  // Keep stable refs to props that change — avoids stale closures in callbacks
  const layersRef = useRef(layers);
  const referenceStrokesRef = useRef(referenceStrokes);
  const userStrokeColorRef = useRef(userStrokeColor);
  const referenceStrokeColorRef = useRef(referenceStrokeColor);
  const toolRef = useRef(tool);
  const smoothingRef = useRef(smoothing);

  useEffect(() => { layersRef.current = layers; layersDirtyRef.current = true; }, [layers]);
  useEffect(() => { referenceStrokesRef.current = referenceStrokes; }, [referenceStrokes]);
  // Kolor jest wypalany w bitmapę warstwy, więc jego zmiana wymaga odtworzenia.
  // W trybie wzorca kolor zmienia się z dokładnością kreski, ale tylko na progach, nie co klatkę.
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
      // Ustawienie rozmiaru czyści bitmapę, więc replay musi nastąpić po nim.
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

  // Cap renders to one per animation frame regardless of pointer event rate
  const scheduleRedraw = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      redrawScene();
    });
  }, [redrawScene]);

  // Przybliżenie kotwiczone w kursorze: punkt rysunku pod kursorem musi zostać na miejscu,
  // inaczej zoom „ucieka" do narożnika i nie da się nim celować.
  const zoomAt = useCallback(
    (screenX: number, screenY: number, factor: number) => {
      const current = viewRef.current;
      const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, current.scale * factor));
      if (nextScale === current.scale) return;

      // Zatrzask na 1:1. Bez niego trafienie dokładnie w skalę 1 kółkiem jest loterią,
      // a to jedyny sposób powrotu do widoku wyjściowego — nie ma przycisku ani panoramowania.
      if (Math.abs(nextScale - 1) < 0.06) {
        viewRef.current = IDENTITY_VIEW;
      } else {
        const drawingX = (screenX - current.offsetX) / current.scale;
        const drawingY = (screenY - current.offsetY) / current.scale;

        viewRef.current = {
          scale: nextScale,
          offsetX: screenX - drawingX * nextScale,
          offsetY: screenY - drawingY * nextScale,
        };
      }

      // Bitmapy warstw są rasteryzowane w skali widoku, więc muszą powstać na nowo —
      // dzięki temu przybliżona kreska jest ostra, a nie rozmytym powiększeniem piksli.
      layersDirtyRef.current = true;
      onViewChange?.(viewRef.current);
      scheduleRedraw();
    },
    [onViewChange, scheduleRedraw],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (event: WheelEvent) => {
      // Bez preventDefault strona przewija się pod płótnem. React rejestruje wheel
      // pasywnie, dlatego nasłuch jest natywny z passive: false.
      event.preventDefault();
      const bounds = canvas.getBoundingClientRect();
      // deltaMode 1 = linie, 2 = strony; normalizujemy do czegoś porównywalnego z pikselami.
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
    // Zmiana rozmiaru czyści bitmapy warstw — trzeba je odtworzyć z operacji.
    layersDirtyRef.current = true;
    redrawScene();
  }, [redrawScene]);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      event.preventDefault();

      // Środkowy (1) i prawy (2) przycisk przesuwają płótno, nie rysują.
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

      // Settings are captured per stroke, so changing them mid-stroke has no effect
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
    [brushOpacity, brushSize, onActiveStrokeChange, onCurrentStrokePointCountChange, onEraseAtPoint, onEraseStart, scheduleRedraw, tool],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const pan = panRef.current;
      if (pan && pan.pointerId === event.pointerId) {
        viewRef.current = {
          scale: pan.origin.scale,
          offsetX: pan.origin.offsetX + (event.clientX - pan.startX),
          offsetY: pan.origin.offsetY + (event.clientY - pan.startY),
        };
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
    [onActiveStrokeChange, onCurrentStrokePointCountChange, onEraseAtPoint, scheduleRedraw, tool],
  );

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;

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

  // Re-render whenever strokes or colors change (e.g. eraser, undo, new stroke)
  useEffect(() => {
    scheduleRedraw();
  }, [layers, referenceStrokes, userStrokeColor, referenceStrokeColor, scheduleRedraw]);

  // Wędrujące kreskowanie aktualnego kroku. Pętla chodzi tylko wtedy, gdy jest co
  // podświetlać i gdy użytkownik nie rysuje — animacja nie ma konkurować z piórem o klatki.
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
