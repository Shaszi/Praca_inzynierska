import { Link } from 'react-router-dom'

export function HomePage() {
  return (
    <section className="flex w-full flex-1 flex-col justify-center gap-8 rounded-2xl border border-slate-300 bg-white/90 p-6 shadow-sm md:p-10">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Drawing Coach</p>
        <h2 className="mt-3 text-4xl font-semibold text-slate-900 md:text-5xl">
          Practice strokes with instant feedback.
        </h2>
        <p className="mt-4 max-w-2xl text-slate-600">
          Use the practice board to train smooth lines and curves. Use teacher mode
          to build custom references and save them locally.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link
          to="/practice"
          className="rounded-2xl border border-sky-300 bg-sky-50 p-5 transition hover:border-sky-400"
        >
          <p className="text-sm uppercase tracking-[0.2em] text-sky-700">Mode</p>
          <h3 className="mt-2 text-2xl font-semibold text-slate-900">Practice</h3>
          <p className="mt-2 text-slate-600">Draw over guides and review stroke quality.</p>
        </Link>

        <Link
          to="/teacher"
          className="rounded-2xl border border-slate-300 bg-slate-50 p-5 transition hover:border-slate-400"
        >
          <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Mode</p>
          <h3 className="mt-2 text-2xl font-semibold text-slate-900">Teacher</h3>
          <p className="mt-2 text-slate-600">Create and save reference drawings in local storage.</p>
        </Link>
      </div>
    </section>
  )
}
