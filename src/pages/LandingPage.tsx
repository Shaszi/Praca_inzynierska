import { Link } from 'react-router-dom'
import { BrandMark } from '../components/BrandMark'
import { SketchIllustration } from '../components/SketchIllustration'
import { useAuth } from '../features/auth/authContext'

const features = [
  {
    title: 'Kreska po kresce',
    body: 'Odrysowujesz wzorzec jedną linią naraz. Algorytm porównuje kształt z wzorcem, a AI mówi, co poprawić.',
  },
  {
    title: 'Dowolne zdjęcie jako lekcja',
    body: 'Wgrywasz zdjęcie, a model rozpisuje je na kroki: od głównych brył do detali.',
  },
  {
    title: 'Cel w dniach',
    body: 'Ustawiasz, ile dni chcesz ćwiczyć. Każdy dzień z ukończonym rysunkiem wypełnia pasek.',
  },
]

export function LandingPage() {
  const { user } = useAuth()

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <BrandMark />
        <nav className="flex items-center gap-2 text-sm">
          {user ? (
            <Link to="/app" className="flex min-h-11 items-center rounded-full bg-accent px-4 font-semibold text-on-accent hover:bg-accent-strong">
              Otwórz aplikację
            </Link>
          ) : (
            <>
              <Link to="/login" className="flex min-h-11 items-center rounded-full px-3 font-semibold text-ink-soft hover:text-ink">
                Zaloguj się
              </Link>
              <Link to="/signup" className="flex min-h-11 items-center rounded-full bg-accent px-4 font-semibold text-on-accent hover:bg-accent-strong">
                Załóż konto
              </Link>
            </>
          )}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6">
        <section className="grid items-center gap-12 py-12 md:grid-cols-[1.05fr_1fr] md:py-20">
          <div>
            <h1 className="text-[40px] font-bold leading-[1.1] tracking-[-0.02em] text-ink sm:text-[52px]">
              Rysuj krok po kroku. Po każdej kresce wiesz, co poprawić.
            </h1>
            <p className="mt-5 max-w-md text-[17px] text-ink-faint">
              Krótkie, codzienne ćwiczenia rysunku z oceną każdej linii. Wyznacz cel w dniach i obserwuj, jak rośnie.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to={user ? '/app' : '/signup'}
                className="flex min-h-11 items-center rounded-full bg-accent px-5 font-semibold text-on-accent transition hover:bg-accent-strong"
              >
                {user ? 'Wróć do ćwiczeń' : 'Zacznij za darmo'}
              </Link>
              {!user && (
                <Link
                  to="/login"
                  className="flex min-h-11 items-center rounded-full border border-ink-faint bg-surface px-5 font-semibold text-ink transition hover:bg-surface-dim"
                >
                  Mam już konto
                </Link>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-[22px] border border-line bg-surface">
            <div className="bg-surface-dim p-4">
              <div className="rounded-full bg-surface p-6 shadow-[0_0_0_1px_var(--color-line)]">
                <SketchIllustration className="w-full" />
              </div>
            </div>
            <div className="flex flex-wrap gap-4 px-5 py-3 text-[13px] text-ink-faint">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block w-5 border-t-[3px] border-ink" /> Twoja kreska
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block w-5 border-t-2 border-dashed border-accent" /> Wzór
              </span>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {features.map((feature) => (
            <article key={feature.title} className="rounded-[22px] border border-line bg-surface p-[18px]">
              <h2 className="text-[17px] font-bold text-ink">{feature.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{feature.body}</p>
            </article>
          ))}
        </section>
      </main>

      <footer className="mx-auto max-w-6xl px-6 py-10 text-sm text-ink-faint">
        Praca inżynierska · {new Date().getFullYear()}
      </footer>
    </div>
  )
}
