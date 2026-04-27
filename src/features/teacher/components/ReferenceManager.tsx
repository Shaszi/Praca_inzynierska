import type { ReferenceDrawing } from '../../../types/drawing'
import { ImportExportControls } from './ImportExportControls'
import { ReferenceSelector } from './ReferenceSelector'
import { TeacherToolbar } from './TeacherToolbar'

type ReferenceManagerProps = {
  references: ReferenceDrawing[]
  selectedReferenceId: string
  onSelectReferenceId: (id: string) => void
  onSaveReference: () => void
  onLoadReference: () => void
  onDeleteReference: () => void
  onExportReference: () => void
  onImportReference: (file: File) => Promise<void>
  isSaving: boolean
  isImporting: boolean
  hasSelectedReference: boolean
}

export function ReferenceManager({
  references,
  selectedReferenceId,
  onSelectReferenceId,
  onSaveReference,
  onLoadReference,
  onDeleteReference,
  onExportReference,
  onImportReference,
  isSaving,
  isImporting,
  hasSelectedReference,
}: ReferenceManagerProps) {
  return (
    <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-300 bg-white p-3 shadow-sm">
      <ReferenceSelector
        references={references}
        selectedId={selectedReferenceId}
        onSelect={onSelectReferenceId}
        label="Saved"
        emptyOptionLabel="Select reference"
      />
      <TeacherToolbar
        onSave={onSaveReference}
        onLoad={onLoadReference}
        onDelete={onDeleteReference}
        isSaving={isSaving}
      />
      <div className="ml-auto">
        <ImportExportControls
          onExport={onExportReference}
          onImport={onImportReference}
          isImporting={isImporting}
          canExport={hasSelectedReference}
        />
      </div>
    </section>
  )
}