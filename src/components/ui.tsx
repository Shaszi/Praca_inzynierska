import type { ButtonHTMLAttributes, ReactNode } from 'react'

// Wspólne elementy interfejsu, żeby wszystkie ekrany wyglądały spójnie.

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md'

const variantClass: Record<ButtonVariant, string> = {
  primary: 'border border-ink bg-ink text-white hover:bg-ink-hover',
  secondary: 'border border-line-strong bg-surface text-ink hover:bg-surface-dim',
  ghost: 'text-ink-soft hover:bg-surface-dim hover:text-ink',
  danger: 'text-ink-soft hover:bg-danger-soft hover:text-danger',
}

const sizeClass: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-3 text-sm',
  md: 'min-h-11 px-4 text-[15px]',
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
        'inline-flex items-center justify-center gap-2 rounded-[10px] font-semibold transition',
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
      className={`flex gap-1 rounded-xl border border-line-strong bg-surface p-1 ${className}`}
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
            'min-h-8 flex-1 rounded-lg px-3 text-sm font-medium transition',
            value === option.value ? 'bg-ink text-white' : 'text-ink-soft hover:bg-surface-dim',
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

/** Mała etykieta sekcji (wersaliki), jak nagłówki kart w projekcie. */
export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p className={`text-xs font-semibold uppercase tracking-[0.08em] text-ink-faint ${className}`}>{children}</p>
  )
}

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-line bg-surface ${className}`}>{children}</section>
}

export function PageHeader({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-[26px] font-bold leading-tight tracking-[-0.01em] text-ink">{title}</h1>
        {description && <p className="mt-1 text-ink-faint">{description}</p>}
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

export const rangeClass = 'h-1.5 cursor-pointer accent-[var(--color-ink)]'

export const selectClass =
  'min-h-11 rounded-[10px] border border-line-strong bg-surface px-3 text-[15px] text-ink transition hover:border-ink-faint focus:border-accent focus:outline-none'
