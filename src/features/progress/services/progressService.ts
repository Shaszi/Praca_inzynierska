import { supabase } from '../../../lib/supabase'
import type { Json, Tables } from '../../../lib/database.types'
import type { Stroke } from '../../../types/drawing'
import type { DailyActivity } from '../utils/goalProgress'

export type Profile = {
  id: string
  displayName: string | null
  goalDays: number | null
  goalStartedOn: string | null
  timezone: string
}

export type PracticeMode = 'reference' | 'image'

export type PracticeAttempt = {
  stepIndex: number
  score: number | null
  /** Komentarz algorytmu. */
  feedback: string | null
  /** Komentarz modelu AI. */
  aiFeedback: string | null
  createdAt: string
}

export type PracticeSessionSummary = {
  id: string
  mode: PracticeMode
  title: string
  stepsTotal: number
  stepsCompleted: number
  averageScore: number | null
  finalStrokes: Stroke[] | null
  startedAt: string
  completedAt: string | null
}

function toProfile(row: Tables<'profiles'>): Profile {
  return {
    id: row.id,
    displayName: row.display_name,
    goalDays: row.goal_days,
    goalStartedOn: row.goal_started_on,
    timezone: row.timezone,
  }
}

function toSession(row: Tables<'practice_sessions'>): PracticeSessionSummary {
  return {
    id: row.id,
    mode: row.mode as PracticeMode,
    title: row.title,
    stepsTotal: row.steps_total,
    stepsCompleted: row.steps_completed,
    averageScore: row.average_score,
    finalStrokes: (row.final_strokes as Stroke[] | null) ?? null,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  }
}

function fail(context: string, error: { message: string }): never {
  throw new Error(`${context}: ${error.message}`)
}

export const progressService = {
  async getProfile(userId: string): Promise<Profile> {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (error) fail('Nie udało się pobrać profilu', error)
    return toProfile(data)
  },

  async setGoal(userId: string, goalDays: number | null, startedOn: string | null): Promise<Profile> {
    const { data, error } = await supabase
      .from('profiles')
      .update({ goal_days: goalDays, goal_started_on: startedOn })
      .eq('id', userId)
      .select('*')
      .single()
    if (error) fail('Nie udało się zapisać celu', error)
    return toProfile(data)
  },

  async getActivity(sinceDay: string): Promise<DailyActivity[]> {
    const { data, error } = await supabase
      .from('daily_activity')
      .select('day, completed_count')
      .gte('day', sinceDay)
      .order('day')
    if (error) fail('Nie udało się pobrać aktywności', error)
    return data.map((row) => ({ day: row.day!, completedCount: row.completed_count ?? 0 }))
  },

  async getRecentSessions(limit: number): Promise<PracticeSessionSummary[]> {
    const { data, error } = await supabase
      .from('practice_sessions')
      .select('*')
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(limit)
    if (error) fail('Nie udało się pobrać historii', error)
    return data.map(toSession)
  },

  async startSession(params: {
    mode: PracticeMode
    title: string
    stepsTotal: number
    referenceId?: string | null
  }): Promise<string> {
    const { data, error } = await supabase
      .from('practice_sessions')
      .insert({
        mode: params.mode,
        title: params.title.slice(0, 200),
        steps_total: params.stepsTotal,
        reference_id: params.referenceId ?? null,
      })
      .select('id')
      .single()
    if (error) fail('Nie udało się rozpocząć sesji', error)
    return data.id
  },

  async recordAttempt(params: {
    sessionId: string
    stepIndex: number
    stroke: Stroke
    score: number | null
    /** Komentarz modelu AI (tryb zdjęcia). */
    aiFeedback?: string | null
    /** Komentarz z algorytmicznej oceny kreski (tryb wzorca). */
    feedback?: string | null
    metrics?: Record<string, unknown> | null
  }): Promise<void> {
    // Jeden krok = jeden wiersz: powtórzona kreska zastępuje poprzednią próbę. Usunięcie
    // przed wstawieniem, w jednym łańcuchu, bo równoległy DELETE zjadałby świeży wiersz.
    await progressService.deleteAttempts(params.sessionId, params.stepIndex)
    const { error } = await supabase.from('practice_attempts').insert({
      session_id: params.sessionId,
      step_index: params.stepIndex,
      stroke: params.stroke as unknown as { [key: string]: Json },
      score: params.score,
      ai_feedback: params.aiFeedback ?? null,
      feedback: params.feedback ?? null,
      metrics: (params.metrics ?? null) as Json,
    })
    if (error) fail('Nie udało się zapisać próby', error)
  },

  /** Historia kroków jednej sesji — to z niej ekran postępu pokazuje, co model napisał. */
  async getAttempts(sessionId: string): Promise<PracticeAttempt[]> {
    const { data, error } = await supabase
      .from('practice_attempts')
      .select('step_index, score, feedback, ai_feedback, created_at')
      .eq('session_id', sessionId)
      .order('step_index')
      .order('created_at')
    if (error) fail('Nie udało się pobrać historii kroków', error)
    return data.map((row) => ({
      stepIndex: row.step_index,
      score: row.score,
      feedback: row.feedback,
      aiFeedback: row.ai_feedback,
      createdAt: row.created_at,
    }))
  },

  /** Porzucona próba (powtórzenie kreski albo cofnięcie kroku) nie ma prawa zostać w historii. */
  async deleteAttempts(sessionId: string, stepIndex: number): Promise<void> {
    const { error } = await supabase
      .from('practice_attempts')
      .delete()
      .eq('session_id', sessionId)
      .eq('step_index', stepIndex)
    if (error) fail('Nie udało się usunąć próby', error)
  },

  async completeSession(params: {
    sessionId: string
    stepsCompleted: number
    averageScore: number | null
    finalStrokes: Stroke[]
  }): Promise<void> {
    const { error } = await supabase
      .from('practice_sessions')
      .update({
        steps_completed: params.stepsCompleted,
        average_score: params.averageScore,
        final_strokes: params.finalStrokes as unknown as Json,
        completed_at: new Date().toISOString(),
      })
      .eq('id', params.sessionId)
    if (error) fail('Nie udało się zakończyć sesji', error)
  },
}
