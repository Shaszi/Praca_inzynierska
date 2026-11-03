import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { BrandMark } from '../../components/BrandMark'
import { SketchIllustration } from '../../components/SketchIllustration'
import { useAuth } from './authContext'

type Mode = 'login' | 'signup'

function translateAuthError(message: string): string {
  if (message.includes('Invalid login credentials')) return 'Nieprawidłowy email lub hasło.'
  if (message.includes('User already registered')) return 'Konto z tym adresem już istnieje.'
  if (message.includes('Password should be at least')) return 'Hasło musi mieć co najmniej 6 znaków.'
  if (message.includes('Email not confirmed')) return 'Potwierdź adres email, klikając link z wiadomości.'
  if (message.includes('provider is not enabled')) return 'Logowanie przez Google nie jest skonfigurowane na serwerze.'
  return message
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.5 14.6 2.5 12 2.5 6.8 2.5 2.6 6.7 2.6 12s4.2 9.5 9.4 9.5c5.4 0 9-3.8 9-9.2 0-.6-.1-1.1-.2-1.6H12z" />
    </svg>
  )
}

export function AuthPage({ mode }: { mode: Mode }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/app'

  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (user) return <Navigate to={redirectTo} replace />

  const isSignup = mode === 'signup'

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setInfo(null)
    setIsSubmitting(true)

    const result = isSignup
      ? await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName.trim() || undefined },
            emailRedirectTo: `${window.location.origin}/app`,
          },
        })
      : await supabase.auth.signInWithPassword({ email, password })

    setIsSubmitting(false)

    if (result.error) return setError(translateAuthError(result.error.message))
    if (isSignup && !result.data.session) {
      return setInfo('Sprawdź skrzynkę — wysłaliśmy link potwierdzający rejestrację.')
    }
    navigate(redirectTo, { replace: true })
  }

  const handleGoogle = async () => {
    setError(null)
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}${redirectTo}` },
    })
    if (oauthError) setError(translateAuthError(oauthError.message))
  }

  const inputClass =
    'min-h-11 w-full rounded-[10px] border border-line-strong bg-surface px-3 text-[15px] text-ink placeholder:text-ink-faint transition focus:border-accent focus:outline-none'

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Link to="/" className="self-start">
          <BrandMark />
        </Link>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h1 className="text-[28px] font-bold leading-tight tracking-[-0.01em] text-ink">
            {isSignup ? 'Załóż konto' : 'Witaj z powrotem'}
          </h1>
          <p className="mt-2 text-ink-soft">
            {isSignup
              ? 'Twoje rysunki, wzorce i postępy zapiszą się na koncie.'
              : 'Zaloguj się, żeby wrócić do ćwiczeń.'}
          </p>

          <button
            type="button"
            onClick={handleGoogle}
            className="mt-8 flex w-full items-center justify-center gap-2.5 min-h-11 rounded-[10px] border border-line-strong bg-surface px-4 text-[15px] font-semibold text-ink transition hover:bg-surface-dim"
          >
            <GoogleIcon />
            Kontynuuj z Google
          </button>

          <div className="my-6 flex items-center gap-3 text-xs text-ink-faint">
            <span className="h-px flex-1 bg-line" />
            lub emailem
            <span className="h-px flex-1 bg-line" />
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {isSignup && (
              <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-soft">
                Imię lub pseudonim
                <input
                  className={inputClass}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={80}
                  autoComplete="nickname"
                />
              </label>
            )}
            <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-soft">
              Email
              <input
                className={inputClass}
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-soft">
              Hasło
              <input
                className={inputClass}
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isSignup ? 'new-password' : 'current-password'}
              />
            </label>

            {error && <p className="rounded-xl bg-danger-soft px-3.5 py-3 text-sm font-medium text-danger">{error}</p>}
            {info && <p className="rounded-xl bg-success-soft px-3.5 py-3 text-sm font-medium text-success">{info}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 min-h-11 rounded-[10px] bg-ink px-4 text-[15px] font-semibold text-white transition hover:bg-ink-hover disabled:opacity-60"
            >
              {isSubmitting ? 'Chwila…' : isSignup ? 'Utwórz konto' : 'Zaloguj się'}
            </button>
          </form>

          <p className="mt-6 text-sm text-ink-soft">
            {isSignup ? 'Masz już konto? ' : 'Nie masz konta? '}
            <Link
              to={isSignup ? '/login' : '/signup'}
              state={location.state}
              className="font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
            >
              {isSignup ? 'Zaloguj się' : 'Zarejestruj się'}
            </Link>
          </p>
        </div>
      </div>

      <div className="hidden items-center justify-center border-l border-line bg-paper-dim p-12 lg:flex">
        <SketchIllustration className="w-full max-w-lg" />
      </div>
    </div>
  )
}
