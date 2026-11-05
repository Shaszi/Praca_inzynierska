import type { ButtonHTMLAttributes, ReactNode } from 'react'

// Wspólne elementy interfejsu, żeby wszystkie ekrany wyglądały spójnie.

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md'

const variantClass: Record<ButtonVariant, string> = {
  primary: 'border-2 border-transparent bg-accent text-on-accent hover:bg-accent-strong',
  // ink-faint, nie line-strong jak w projekcie: ramka jest tu jedynym wyznacznikiem
  // kontrolki, a line-strong daje na surface 2.01:1, czyli poniżej progu 3:1 dla elementów
  // nietekstowych. Pozostałe ramki w projekcie są dekoracyjne i zostają bez zmian.
  secondary: 'border-2 border-ink-faint bg-transparent text-ink hover:border-ink',
  ghost: 'border-2 border-transparent bg-surface-dim text-ink-soft hover:bg-line-strong hover:text-ink',
  danger: 'border-2 border-transparent bg-surface-dim text-danger hover:bg-danger-soft',
}

const sizeClass: Record<ButtonSize, string> = {
  sm: 'min-h-10 px-4 text-sm',
  md: 'min-h-12 px-[22px] text-[15px]',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      type="button"
      className={[
        // Pastylka i dociśnięcie przy kliknięciu — tak jak w projekcie.
        'inline-flex items-center justify-center gap-2 rounded-full font-bold transition active:scale-[0.97]',
        'disabled:pointer-events-none disabled:opacity-40',
        variantClass[variant],
        sizeClass[size],
        className,
      ].join(' ')}
      {...props}
    />
  )
}

type SegmentedOption<T extends string> = { value: T; label: ReactNode; title?: string }

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className = '',
  ariaLabel,
}: {
  options: SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
  ariaLabel?: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`inline-flex gap-0.5 rounded-full border border-line bg-paper-dim p-1 ${className}`}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          title={option.title}
          onClick={() => onChange(option.value)}
          className={[
            'min-h-[38px] flex-1 rounded-full px-4 text-sm font-semibold transition',
            value === option.value ? 'bg-violet text-on-accent' : 'text-ink-faint hover:text-ink',
          ].join(' ')}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function Divider() {
  return <span className="mx-1 hidden h-6 w-px bg-line sm:block" aria-hidden />
}

/** Mała etykieta sekcji (wersaliki), jak nagłówki kart w projekcie.
 *  `as` istnieje, bo część tych etykiet to prawdziwe nagłówki sekcji — jako <p>
 *  zniknęłyby ze struktury dokumentu dla czytnika ekranu. */
export function Eyebrow({
  children,
  className = '',
  as: Tag = 'p',
}: {
  children: ReactNode
  className?: string
  as?: 'p' | 'h2' | 'h3'
}) {
  return (
    <Tag className={`text-xs font-semibold uppercase tracking-[0.08em] text-ink-faint ${className}`}>{children}</Tag>
  )
}

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-[22px] border border-line bg-surface ${className}`}>{children}</section>
}

export function PageHeader({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-[clamp(26px,3.4vw,34px)] font-bold leading-[1.1] text-ink">{title}</h1>
        {description && <p className="mt-2 max-w-[62ch] text-ink-soft">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  )
}

export function Spinner({ className = '' }: { className?: string }) {
  return <span className={`inline-block h-5 w-5 animate-spin rounded-full border-2 border-line border-t-accent ${className}`} />
}

export function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden>
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  )
}

export const rangeClass = 'h-1.5 cursor-pointer accent-[var(--color-accent)]'

export const selectClass =
  'min-h-11 rounded-full border border-ink-faint bg-surface px-4 text-[15px] text-ink transition hover:border-ink-soft focus:border-accent focus:outline-none'
