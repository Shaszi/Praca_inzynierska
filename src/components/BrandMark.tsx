export function BrandMark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg width="34" height="34" viewBox="0 0 34 34" className="shrink-0" aria-hidden>
        <rect width="34" height="34" rx="11" fill="var(--color-surface-dim)" />
        <defs>
          {/* Gradient markera. Reguła z projektu: tylko kreska, logo i pasek postępu. */}
          <linearGradient id="brand-marker" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#ff5fa8" />
            <stop offset="0.55" stopColor="#ff9a3d" />
            <stop offset="1" stopColor="#ffd84a" />
          </linearGradient>
        </defs>
        <path
          d="M8 22 C12 10, 16 26, 20 15 S 25 12, 27 11"
          fill="none"
          stroke="url(#brand-marker)"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>
      <span className="font-display text-[19px] font-bold tracking-[-0.02em] text-ink">Kreska</span>
    </span>
  )
}
