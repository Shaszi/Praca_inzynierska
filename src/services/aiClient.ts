import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

/** Błąd z Edge Function — `message` jest już gotowym komunikatem dla użytkownika. */
export class AiError extends Error {
  readonly code: string

  constructor(message: string, code: string) {
    super(message)
    this.code = code
  }
}

// Wszystkie wywołania modelu idą przez Edge Function "ai" — klucz API nie trafia do przeglądarki.
export async function invokeAi<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>('ai', { body })

  if (error) {
    if (error instanceof FunctionsHttpError) {
      const payload = (await error.context.json().catch(() => null)) as { error?: string; code?: string } | null
      if (payload?.error) throw new AiError(payload.error, payload.code ?? 'error')
    }
    throw new AiError('Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.', 'network')
  }
  if (data === null) throw new AiError('Pusta odpowiedź serwera. Spróbuj ponownie.', 'empty')
  return data
}

export function describeAiError(error: unknown): string {
  if (error instanceof AiError) return error.message
  console.error(error)
  return 'Błąd połączenia z AI. Spróbuj ponownie za chwilę.'
}
