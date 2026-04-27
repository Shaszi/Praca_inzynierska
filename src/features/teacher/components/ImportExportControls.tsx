import { useCallback, useRef } from 'react'
import type { ChangeEvent } from 'react'

type ImportExportControlsProps = {
  onExport: () => void
  onImport: (file: File) => Promise<void>
  isImporting: boolean
  canExport: boolean
}

export function ImportExportControls({
  onExport,
  onImport,
  isImporting,
  canExport,
}: ImportExportControlsProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const openFilePicker = useCallback(() => {
    inputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (!file) return
      void onImport(file)
    },
    [onImport],
  )

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={onExport}
        disabled={!canExport}
        className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Export
      </button>
      <button
        type="button"
        onClick={openFilePicker}
        disabled={isImporting}
        className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isImporting ? 'Importing...' : 'Import JSON'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  )
}