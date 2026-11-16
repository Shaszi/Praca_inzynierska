import { LayerPanel } from '../../../canvas/components/LayerPanel'
import type { Layer, Stroke } from '../../../../types/drawing'

export function LayersDock({
  layers,
  activeLayerId,
  guideOpacity,
  onGuideOpacity,
  guideStrokes,
  onSelect,
  onUpdate,
  onMove,
  onRemove,
  onAdd,
}: {
  layers: Layer[]
  activeLayerId: string
  guideOpacity: number
  onGuideOpacity: (value: number) => void
  guideStrokes: Stroke[]
  onSelect: (id: string) => void
  onUpdate: (id: string, change: (layer: Layer) => Layer) => void
  onMove: (id: string, direction: -1 | 1) => void
  onRemove: (id: string) => void
  onAdd: () => void
}) {
  return (
    <aside
      className="w-[290px] max-w-[88%] shrink-0 overflow-auto rounded-[18px] border border-line bg-surface p-3.5"
      aria-label="Warstwy"
    >
      <LayerPanel
        layers={layers}
        activeLayerId={activeLayerId}
        guideOpacity={guideOpacity}
        onGuideOpacity={onGuideOpacity}
        guideStrokes={guideStrokes}
        onSelect={onSelect}
        onToggleVisible={(id) => onUpdate(id, (layer) => ({ ...layer, visible: !layer.visible }))}
        onToggleLock={(id) => onUpdate(id, (layer) => ({ ...layer, locked: !layer.locked }))}
        onOpacity={(id, value) => onUpdate(id, (layer) => ({ ...layer, opacity: value }))}
        onMove={onMove}
        onRemove={onRemove}
        onAdd={onAdd}
      />
    </aside>
  )
}
