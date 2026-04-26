import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <section className="flex w-full flex-1 flex-col items-center justify-center gap-4 rounded-2xl border border-slate-300 bg-white p-8 text-center shadow-sm">
      <p className="text-sm uppercase tracking-[0.2em] text-slate-500">404</p>
      <h2 className="text-3xl font-semibold text-slate-900">Page not found</h2>
      <p className="max-w-md text-slate-600">
        This route does not exist. Return home and continue training.
      </p>
      <Link
        to="/"
        className="rounded-lg border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700 transition hover:border-sky-400"
      >
        Go Home
      </Link>
    </section>
  )
}
