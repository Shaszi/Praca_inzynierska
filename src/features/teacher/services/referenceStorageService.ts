import { supabase } from '../../../lib/supabase'
import type { Json, Tables } from '../../../lib/database.types'
import type { ReferenceDrawing, Stroke } from '../../../types/drawing'
import { normalizeReference } from '../utils/referenceValidation'
import type { StorageResult } from './storageTypes'

function toReference(row: Tables<'drawing_references'>): ReferenceDrawing | null {
  return normalizeReference({
    id: row.id,
    name: row.name,
    strokes: row.strokes,
    createdAt: new Date(row.created_at).getTime(),
  })
}

// Wzorce są przechowywane w tabeli drawing_references; RLS ogranicza je do zalogowanego użytkownika.
export const referenceStorageService = {
  async loadReferences(): Promise<StorageResult<ReferenceDrawing[]>> {
    const { data, error } = await supabase
      .from('drawing_references')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) return { data: [], error: 'Nie udało się pobrać wzorców.' }

    const references = data.map(toReference).filter((reference): reference is ReferenceDrawing => reference !== null)
    return {
      data: references,
      error: references.length === data.length ? null : 'Część wzorców jest uszkodzona i została pominięta.',
    }
  },

  async insertReference(name: string, strokes: Stroke[]): Promise<StorageResult<ReferenceDrawing | null>> {
    const { data, error } = await supabase
      .from('drawing_references')
      .insert({ name, strokes: strokes as unknown as Json[] })
      .select('*')
      .single()

    if (error) return { data: null, error: 'Nie udało się zapisać wzorca.' }
    return { data: toReference(data), error: null }
  },

  async deleteReference(id: string): Promise<StorageResult<null>> {
    const { error } = await supabase.from('drawing_references').delete().eq('id', id)
    return { data: null, error: error ? 'Nie udało się usunąć wzorca.' : null }
  },
}
