import { useCallback, useRef } from 'react'
import type { ChangeEvent } from 'react'
import { Button } from '../../../components/ui'

type ImportControlProps = {
  onImport: (file: File) => Promise<void>
  isImporting: boolean
}

export function ImportControl({ onImport, isImporting }: ImportControlProps) {
  const inputRef = useRef<HTMLInputElement>(null)

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
    <>
      <Button size="sm" onClick={() => inputRef.current?.click()} disabled={isImporting}>
        {isImporting ? 'Importowanie…' : 'Importuj z JSON'}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        onChange={handleFileChange}
        className="hidden"
      />
    </>
  )
}
