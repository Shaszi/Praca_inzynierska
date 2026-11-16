import { useRef, useState } from 'react'
import { ImageIcon } from '../../../../components/icons'
import { ACCEPTED_TYPES } from '../../utils/photoFile'

export function PhotoDropzone({ onFile }: { onFile: (file: File) => void }) {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div
      role="button"
      tabIndex={0}
      onDrop={(e) => {
        e.preventDefault()
        setIsDragging(false)
        const file = e.dataTransfer.files[0]
        if (file) onFile(file)
      }}
      onDragOver={(e) => {
        e.preventDefault()
        setIsDragging(true)
      }}
      onDragLeave={() => setIsDragging(false)}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
      }}
      className={`flex flex-1 cursor-pointer flex-col items-center justify-center gap-4 rounded-[22px] border-2 border-dashed px-6 py-20 text-center transition ${
        isDragging ? 'border-accent bg-accent-soft/40' : 'border-ink-faint bg-surface hover:border-accent hover:bg-accent-soft/40'
      }`}
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-paper-dim text-ink">
        <ImageIcon className="h-7 w-7" />
      </span>
      <div>
        <p className="font-medium text-ink">Przeciągnij zdjęcie tutaj albo kliknij, żeby wybrać plik</p>
        <p className="mt-1 text-sm text-ink-faint">JPG, PNG, WebP lub GIF</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFile(file)
        }}
      />
    </div>
  )
}
