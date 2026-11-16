import { useEffect, useState, type ReactNode } from 'react'
import { Button } from '../../../components/ui'

const PIN_KEY = 'practice-menu-pinned'

export function PracticeLayout({
  isFullscreen,
  tools,
  canvas,
  panel,
}: {
  isFullscreen: boolean
  tools: ReactNode
  canvas: ReactNode
  panel: ReactNode
}) {
  const [isPinned, setIsPinned] = useState(() => localStorage.getItem(PIN_KEY) === '1')
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const togglePin = () => {
    localStorage.setItem(PIN_KEY, isPinned ? '0' : '1')
    setIsPinned(!isPinned)
    setIsMenuOpen(true)
  }

  // Przypięcie i pełny ekran zmieniają kadr tak jak obrót tabletu, więc dopasowujemy go
  // tą samą ścieżką co przy zmianie okna. Obserwator rozmiaru celowo tego nie robi.
  useEffect(() => {
    window.dispatchEvent(new Event('resize'))
  }, [isFullscreen, isPinned])

  const floating = isFullscreen && !isPinned
  const showMenu = !isFullscreen || isPinned || isMenuOpen

  return (
    <div
      className={
        isFullscreen
          ? 'fixed inset-0 z-[60] flex gap-[18px] bg-paper-dim p-4 select-none [-webkit-touch-callout:none]'
          : 'grid min-h-0 flex-1 gap-[18px] select-none [-webkit-touch-callout:none] lg:grid-cols-[minmax(0,1fr)_340px]'
      }
    >
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col gap-3.5">
        {!isFullscreen && tools}
        {canvas}
        {floating && !isMenuOpen && (
          <Button variant="secondary" className="absolute top-3 right-3 z-20 shadow-lg" onClick={() => setIsMenuOpen(true)}>
            Menu
          </Button>
        )}
      </div>

      {showMenu && (
        <aside
          className={
            !isFullscreen
              ? // contain:size — panel oceny zmienia wysokość przy każdej kresce; gdyby niósł wysokość wiersza, strona skracała się pod ręką i przewijała do góry.
                'flex min-w-0 flex-col gap-3.5 lg:overflow-y-auto lg:[contain:size]'
              : floating
                ? 'absolute top-7 right-7 bottom-7 z-30 flex w-[380px] max-w-[calc(100%-56px)] flex-col gap-3.5 overflow-y-auto rounded-[22px] border border-line bg-surface p-3.5 shadow-xl'
                : 'flex w-[380px] shrink-0 flex-col gap-3.5 overflow-y-auto'
          }
        >
          {isFullscreen && (
            <>
              <div className="flex items-center gap-2">
                <strong className="flex-1 font-display text-[17px]">Narzędzia</strong>
                <Button variant="ghost" size="sm" onClick={togglePin} aria-pressed={isPinned}>
                  {isPinned ? 'Odepnij' : 'Przypnij'}
                </Button>
                {floating && (
                  <Button variant="ghost" size="sm" onClick={() => setIsMenuOpen(false)}>
                    Ukryj
                  </Button>
                )}
              </div>
              {tools}
            </>
          )}
          {panel}
        </aside>
      )}
    </div>
  )
}
