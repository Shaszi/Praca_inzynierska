import { selectClass } from '../../../components/ui'
import type { ReferenceDrawing } from '../../../types/drawing'

type ReferenceSelectorProps = {
  references: ReferenceDrawing[]
  selectedId: string
  onSelect: (id: string) => void
  label: string
  emptyOptionLabel: string
}

export function ReferenceSelector({
  references,
  selectedId,
  onSelect,
  label,
  emptyOptionLabel,
}: ReferenceSelectorProps) {
  return (
    <label className="flex items-center gap-2">
      <span className="sr-only">{label}</span>
      <select value={selectedId} onChange={(event) => onSelect(event.target.value)} className={`min-w-48 ${selectClass}`}>
        <option value="">{emptyOptionLabel}</option>
        {references.map((reference) => (
          <option key={reference.id} value={reference.id}>
            {reference.name}
          </option>
        ))}
      </select>
    </label>
  )
}
