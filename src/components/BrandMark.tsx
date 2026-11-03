export function BrandMark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-on-accent">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M3 21c3-1 5-3 7-6" />
          <path d="M14.5 4.5l5 5L10 19l-5 1 1-5z" />
        </svg>
      </span>
      <span className="text-[17px] font-bold tracking-[-0.01em] text-ink">Trening kreski</span>
    </span>
  )
}
