import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <section className="flex w-full flex-1 flex-col items-center justify-center gap-4 rounded-2xl border border-slate-700/60 bg-slate-900/50 p-8 text-center">
      <p className="text-sm uppercase tracking-[0.2em] text-slate-400">404</p>
      <h2 className="text-3xl font-semibold text-slate-100">Page not found</h2>
      <p className="max-w-md text-slate-300">
        This route does not exist. Return home and continue training.
      </p>
      <Link
        to="/"
        className="rounded-lg border border-cyan-500/50 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:border-cyan-300"
      >
        Go Home
      </Link>
    </section>
  )
}