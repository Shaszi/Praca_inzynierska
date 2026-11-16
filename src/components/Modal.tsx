import { useEffect, type ReactNode } from 'react'
import { Button } from './ui'

export function Modal({
  title,
  children,
  onClose,
  closeLabel = 'Rozumiem',
  size = 'sm',
}: {
  title: string
  children: ReactNode
  onClose: () => void
  closeLabel?: string
  size?: 'sm' | 'lg'
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-[rgb(13_11_32_/_0.72)] p-4 backdrop-blur-[2px]"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`flex w-full flex-col gap-3 rounded-[22px] border border-line-strong bg-surface p-5 shadow-[var(--shadow-float)] ${
          size === 'lg' ? 'max-h-[86vh] max-w-[940px]' : 'max-w-[380px]'
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="modal-title" className="font-display text-[20px] font-bold leading-[1.15]">
          {title}
        </h2>
        <div className={`text-[15px] text-ink-soft ${size === 'lg' ? 'min-h-0 flex-1 overflow-auto' : ''}`}>
          {children}
        </div>
        <Button autoFocus variant="primary" size="sm" className="self-end" onClick={onClose}>
          {closeLabel}
        </Button>
      </div>
    </div>
  )
}
