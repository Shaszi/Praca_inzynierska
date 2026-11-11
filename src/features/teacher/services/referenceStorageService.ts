import { supabase } from '../../../lib/supabase'
import type { Json, Tables } from '../../../lib/database.types'
import type { Publication, ReferenceDrawing, Stroke } from '../../../types/drawing'
import { normalizeReference } from '../utils/referenceValidation'
import { cloneStrokes } from '../../../utils/strokes'
import type { StorageResult } from './storageTypes'

export type LibraryFilter = 'mine' | 'public' | 'pending'

type Row = Tables<'drawing_references'>

function isPublication(value: string): value is Publication {
  return value === 'private' || value === 'pending' || value === 'public' || value === 'rejected'
}

/**
 * `normalizeReference` kopiuje po białej liście i celowo obcina wszystko poza
 * id/name/strokes/createdAt — to granica zaufania. Pola publikacji dokładamy więc
 * tutaj, z wiersza, który już przeszedł przez bazę.
 */
function toReference(row: Row, currentUserId: string | null, authorNames?: Map<string, string>): ReferenceDrawing | null {
  const base = normalizeReference({
    id: row.id,
    name: row.name,
    strokes: row.strokes,
    createdAt: new Date(row.created_at).getTime(),
  })
  if (!base) return null

  return {
    ...base,
    publication: isPublication(row.publication) ? row.publication : 'private',
    isMine: currentUserId !== null && row.user_id === currentUserId,
    authorName: authorNames?.get(row.user_id),
    moderationReason: row.moderation_reason,
  }
}

/**
 * Nazwy autorów osobnym zapytaniem, bo `drawing_references.user_id` wskazuje na
 * `auth.users`, a nie na `profiles` — PostgREST nie zna takiej relacji i nie zrobi
 * osadzonego joina. Dodanie drugiego klucza obcego dałoby nowy tryb awarii: brak
 * wiersza profilu blokowałby zapis wzorca.
 */
async function loadAuthorNames(userIds: string[], currentId: string | null): Promise<Map<string, string>> {
  const foreign = [...new Set(userIds)].filter((id) => id !== currentId)
  if (foreign.length === 0) return new Map()

  const { data } = await supabase.from('profiles').select('id, display_name').in('id', foreign)
  return new Map((data ?? []).filter((row) => row.display_name).map((row) => [row.id, row.display_name as string]))
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}

// Wzorce leżą w drawing_references; RLS decyduje, które wiersze klient w ogóle zobaczy.
export const referenceStorageService = {
  /**
   * `filter` zawęża zapytanie, ale bezpieczeństwo trzyma RLS — zapytanie o 'pending'
   * bez roli moderatora po prostu nie zwróci wierszy, zamiast zwrócić błąd.
   */
  async loadReferences(filter: LibraryFilter = 'mine'): Promise<StorageResult<ReferenceDrawing[]>> {
    const userId = await currentUserId()

    let query = supabase
      .from('drawing_references')
      .select('*')
      .order('created_at', { ascending: false })

    if (filter === 'mine' && userId) query = query.eq('user_id', userId)
    if (filter === 'public') query = query.eq('publication', 'public')
    if (filter === 'pending') query = query.eq('publication', 'pending')

    const { data, error } = await query
    if (error) return { data: [], error: 'Nie udało się pobrać wzorców.' }

    const authorNames = await loadAuthorNames(data.map((row) => row.user_id), userId)
    const references = data
      .map((row) => toReference(row, userId, authorNames))
      .filter((reference): reference is ReferenceDrawing => reference !== null)

    return {
      data: references,
      error: references.length === data.length ? null : 'Część wzorców jest uszkodzona i została pominięta.',
    }
  },

  async getReference(id: string): Promise<StorageResult<ReferenceDrawing | null>> {
    const userId = await currentUserId()
    const { data, error } = await supabase
      .from('drawing_references')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) return { data: null, error: 'Nie udało się pobrać wzorca.' }
    if (!data) return { data: null, error: 'Nie znaleziono tego wzorca.' }
    const authorNames = await loadAuthorNames([data.user_id], userId)
    return { data: toReference(data, userId, authorNames), error: null }
  },

  async insertReference(name: string, strokes: Stroke[]): Promise<StorageResult<ReferenceDrawing | null>> {
    const userId = await currentUserId()
    const { data, error } = await supabase
      .from('drawing_references')
      .insert({ name: name.trim(), strokes: cloneStrokes(strokes) as unknown as Json[] })
      .select('*')
      .single()

    if (error) return { data: null, error: 'Nie udało się zapisać wzorca.' }
    return { data: toReference(data, userId), error: null }
  },

  /**
   * `.select('id')` jest tu konieczne: bez niego PostgREST nie zgłasza błędu, gdy RLS nie
   * dopuści żadnego wiersza, więc UI mówiłoby „Usunięto" o cudzym wzorcu.
   */
  async deleteReference(id: string): Promise<StorageResult<null>> {
    const { data, error } = await supabase.from('drawing_references').delete().eq('id', id).select('id')

    if (error) return { data: null, error: 'Nie udało się usunąć wzorca.' }
    if (data.length === 0) return { data: null, error: 'Nie możesz usunąć tego wzorca.' }
    return { data: null, error: null }
  },

  /** Decyzja moderatora idzie przez RPC, bo kolumny publication klient nie może tknąć. */
  async moderate(id: string, approved: boolean, reason?: string): Promise<string | null> {
    const { error } = await supabase.rpc('moderate_reference', {
      p_reference_id: id,
      p_approved: approved,
      p_reason: reason ?? undefined,
    })
    if (!error) return null
    return error.code === '42501' ? 'Nie masz uprawnień moderatora.' : 'Nie udało się zapisać decyzji.'
  },

  cloneReferenceStrokes(reference: ReferenceDrawing): Stroke[] {
    return cloneStrokes(reference.strokes)
  },
}
