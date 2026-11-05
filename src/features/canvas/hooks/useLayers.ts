import { useCallback, useMemo, useState } from 'react'
import { useHistory } from '../../../hooks/useHistory'
import type { Layer, Stroke } from '../../../types/drawing'
import { cloneStrokes } from '../../../utils/strokes'

/** Warstwa, na której liczy się ocena. Reguła z projektu: punkty idą tylko z „Ćwiczenia". */
export const PRACTICE_LAYER_ID = 'cw'

function createLayer(id: string, name: string): Layer {
  return { id, name, visible: true, opacity: 1, strokes: [], erases: [] }
}

function cloneLayers(layers: Layer[]): Layer[] {
  return layers.map((layer) => ({
    ...layer,
    strokes: cloneStrokes(layer.strokes),
    erases: layer.erases.map((stamp) => ({ ...stamp })),
  }))
}

const initialLayers = (): Layer[] => [createLayer(PRACTICE_LAYER_ID, 'Ćwiczenie')]

/**
 * Warstwy jak przezroczyste kalki: layers[0] jest najniżej.
 *
 * Historia obejmuje całą tablicę warstw, więc cofanie działa też na dodaniu,
 * usunięciu i przełożeniu warstwy, nie tylko na kreskach.
 */
export function useLayers() {
  const { state, set, undo, redo, canUndo, canRedo } = useHistory<Layer[]>(initialLayers(), {
    clone: cloneLayers,
  })
  const [activeLayerId, setActiveLayerId] = useState(PRACTICE_LAYER_ID)
  // Podgląd wymazywania: jedno pociągnięcie gumką = jeden wpis w historii.
  const [erasePreview, setErasePreview] = useState<Layer[] | null>(null)

  const layers = erasePreview ?? state.present
  const activeLayer = useMemo(
    () => layers.find((layer) => layer.id === activeLayerId) ?? layers[layers.length - 1] ?? null,
    [activeLayerId, layers],
  )

  /** Kreski wszystkich widocznych warstw, od dołu — to, co widzi ocena, zapis i miniatury. */
  const flatStrokes = useMemo(
    () => layers.filter((layer) => layer.visible).flatMap((layer) => layer.strokes),
    [layers],
  )

  const updateLayer = useCallback(
    (id: string, change: (layer: Layer) => Layer) => {
      set(state.present.map((layer) => (layer.id === id ? change(layer) : layer)))
    },
    [set, state.present],
  )

  const addStroke = useCallback(
    (stroke: Stroke) => {
      const target = state.present.find((layer) => layer.id === activeLayerId)
      if (!target || target.locked) return
      set(
        state.present.map((layer) =>
          layer.id === activeLayerId ? { ...layer, strokes: [...layer.strokes, stroke] } : layer,
        ),
      )
    },
    [activeLayerId, set, state.present],
  )

  const addLayer = useCallback(() => {
    const used = new Set(state.present.map((layer) => layer.id))
    let index = state.present.length + 1
    while (used.has(`layer-${index}`)) index += 1
    const layer = createLayer(`layer-${index}`, `Warstwa ${index}`)
    set([...state.present, layer])
    setActiveLayerId(layer.id)
  }, [set, state.present])

  const removeLayer = useCallback(
    (id: string) => {
      // Ostatnia warstwa zostaje — bez niej nie ma gdzie rysować.
      if (state.present.length <= 1) return
      const remaining = state.present.filter((layer) => layer.id !== id)
      set(remaining)
      if (id === activeLayerId) setActiveLayerId(remaining[remaining.length - 1].id)
    },
    [activeLayerId, set, state.present],
  )

  const moveLayer = useCallback(
    (id: string, direction: -1 | 1) => {
      const index = state.present.findIndex((layer) => layer.id === id)
      const target = index + direction
      if (index === -1 || target < 0 || target >= state.present.length) return
      const next = [...state.present]
      ;[next[index], next[target]] = [next[target], next[index]]
      set(next)
    },
    [set, state.present],
  )

  const beginEraseSession = useCallback(() => setErasePreview(cloneLayers(state.present)), [state.present])

  const eraseInSession = useCallback(
    (change: (strokes: Stroke[]) => Stroke[]) => {
      setErasePreview((current) =>
        (current ?? state.present).map((layer) =>
          layer.id === activeLayerId && !layer.locked ? { ...layer, strokes: change(layer.strokes) } : layer,
        ),
      )
    },
    [activeLayerId, state.present],
  )

  const endEraseSession = useCallback(() => {
    if (!erasePreview) return
    set(erasePreview)
    setErasePreview(null)
  }, [erasePreview, set])

  // Przez set, nie przez podmianę stanu: czyszczenie ma dać się cofnąć.
  const clear = useCallback(() => {
    setErasePreview(null)
    set(initialLayers())
    setActiveLayerId(PRACTICE_LAYER_ID)
  }, [set])

  return {
    layers,
    activeLayer,
    activeLayerId,
    setActiveLayerId,
    flatStrokes,
    addStroke,
    addLayer,
    removeLayer,
    moveLayer,
    updateLayer,
    beginEraseSession,
    eraseInSession,
    endEraseSession,
    clear,
    undo: () => {
      setErasePreview(null)
      undo()
    },
    redo: () => {
      setErasePreview(null)
      redo()
    },
    canUndo,
    canRedo,
  }
}

/**
 * Opakowanie płaskiej tablicy kresek w jedną warstwę — dla ekranów, które nie mają
 * panelu warstw. Memoizowane, bo nowa tożsamość tablicy unieważnia bitmapy i wymusza
 * pełny replay przy każdym renderze.
 */
export function useSingleLayer(strokes: Stroke[]): Layer[] {
  return useMemo(
    () => [{ id: 'base', name: 'Rysunek', visible: true, opacity: 1, strokes, erases: [] }],
    [strokes],
  )
}
