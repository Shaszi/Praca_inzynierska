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
    <label className="flex items-center gap-2 text-sm text-slate-700">
      <span className="font-medium">{label}</span>
      <select
        value={selectedId}
        onChange={(event) => onSelect(event.target.value)}
        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 focus:border-sky-500 focus:outline-none"
      >
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