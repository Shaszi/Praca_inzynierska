import { Link } from 'react-router-dom'

export function HomePage() {
  return (
    <section className="flex w-full flex-1 flex-col justify-center gap-8 rounded-2xl border border-slate-300 bg-white/90 p-6 shadow-sm md:p-10">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Drawing Coach</p>
        <h2 className="mt-3 text-4xl font-semibold text-slate-900 md:text-5xl">
          Ćwicz kreski z feedbackiem AI.
        </h2>
        <p className="mt-4 max-w-2xl text-slate-600">
          Trenuj płynne linie i krzywe. Wgraj własne zdjęcie, a AI podzieli je na kroki i oceni każdą kreskę.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Link
          to="/practice"
          className="rounded-2xl border border-sky-300 bg-sky-50 p-5 transition hover:border-sky-400"
        >
          <p className="text-sm uppercase tracking-[0.2em] text-sky-700">Tryb</p>
          <h3 className="mt-2 text-2xl font-semibold text-slate-900">Ćwiczenie</h3>
          <p className="mt-2 text-slate-600">Rysuj według wzorców z trybu nauczyciela, kreska po kresce.</p>
        </Link>

        <Link
          to="/practice/image"
          className="rounded-2xl border border-violet-300 bg-violet-50 p-5 transition hover:border-violet-400"
        >
          <p className="text-sm uppercase tracking-[0.2em] text-violet-700">Tryb</p>
          <h3 className="mt-2 text-2xl font-semibold text-slate-900">Ze zdjęcia</h3>
          <p className="mt-2 text-slate-600">Wgraj zdjęcie — AI wygeneruje plan kroków i oceni Twój rysunek.</p>
        </Link>

        <Link
          to="/teacher"
          className="rounded-2xl border border-slate-300 bg-slate-50 p-5 transition hover:border-slate-400"
        >
          <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Tryb</p>
          <h3 className="mt-2 text-2xl font-semibold text-slate-900">Nauczyciel</h3>
          <p className="mt-2 text-slate-600">Twórz i zapisuj własne wzorce kresek w localStorage.</p>
        </Link>
      </div>
    </section>
  )
}
