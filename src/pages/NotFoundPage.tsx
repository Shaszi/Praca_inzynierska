import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <section className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-mono text-6xl font-medium text-ink-faint">404</p>
      <h1 className="text-2xl font-semibold text-ink">Nie ma takiej strony</h1>
      <p className="max-w-md text-ink-soft">Ten adres nie istnieje albo został przeniesiony.</p>
      <Link
        to="/"
        className="mt-2 inline-flex min-h-11 items-center rounded-full bg-accent px-4 text-[15px] font-semibold text-on-accent transition hover:bg-accent-strong"
      >
        Strona główna
      </Link>
    </section>
  )
}
