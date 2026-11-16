import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Modal } from '../../../../components/Modal'
import { Button } from '../../../../components/ui'
import { LibraryGrid, type LibraryAction } from '../../../teacher/components/LibraryGrid'
import type { ReferenceDrawing } from '../../../../types/drawing'

export function ReferencePickerModal({
  references,
  isLoading,
  onRefresh,
  onPick,
  onClose,
}: {
  references: ReferenceDrawing[]
  isLoading: boolean
  onRefresh: () => void
  onPick: (referenceId: string) => void
  onClose: () => void
}) {
  const actions = useMemo<LibraryAction[]>(
    () => [{ label: 'Wybierz', variant: 'primary', onRun: onPick }],
    [onPick],
  )

  return (
    <Modal title="Wybierz wzorzec" size="lg" closeLabel="Zamknij" onClose={onClose}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onRefresh} disabled={isLoading}>
          Odśwież
        </Button>
        <Link to="/app/library" className="text-sm font-semibold text-accent underline-offset-2 hover:underline">
          Otwórz pełną bibliotekę
        </Link>
      </div>
      <LibraryGrid
        references={references}
        isLoading={isLoading}
        showStatus={false}
        emptyText="Nie ma żadnego wzorca. Narysuj własny w edytorze albo zajrzyj do biblioteki."
        actions={actions}
      />
    </Modal>
  )
}
