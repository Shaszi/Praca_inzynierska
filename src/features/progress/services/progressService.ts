import { supabase } from '../../../lib/supabase'
import type { Json, Tables } from '../../../lib/database.types'
import type { Stroke } from '../../../types/drawing'
import type { DailyActivity } from '../utils/goalProgress'
import { photoService } from './photoService'

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
  feedback: string | null
  aiFeedback: string | null
  createdAt: string
}

export type ImageProject = {
  id: string
  title: string
  stepIndex: number
  stepsTotal: number
  photoPath: string
  strokes: Stroke[]
  startedAt: string
  isDone: boolean
}

export type PracticeSessionSummary = {
  id: string
  photoPath: string | null
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
    photoPath: row.photo_path,
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

  async getSessionsPage(page: number, pageSize: number): Promise<{ sessions: PracticeSessionSummary[]; total: number }> {
    const { data, error, count } = await supabase
      .from('practice_sessions')
      .select('*', { count: 'exact' })
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1)
    if (error) fail('Nie udało się pobrać historii', error)
    return { sessions: data.map(toSession), total: count ?? 0 }
  },

  async startSession(params: {
    mode: PracticeMode
    title: string
    stepsTotal: number
    referenceId?: string | null
    photoPath?: string | null
    course?: unknown[] | null
  }): Promise<string> {
    const { data, error } = await supabase
      .from('practice_sessions')
      .insert({
        mode: params.mode,
        title: params.title.slice(0, 200),
        steps_total: params.stepsTotal,
        reference_id: params.referenceId ?? null,
        photo_path: params.photoPath ?? null,
        course: (params.course ?? null) as Json,
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
    aiFeedback?: string | null
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

  async listImageProjects(limit = 12): Promise<ImageProject[]> {
    const { data, error } = await supabase
      .from('practice_sessions')
      .select('id, title, step_index, steps_total, photo_path, final_strokes, started_at, completed_at')
      .eq('mode', 'image')
      .not('photo_path', 'is', null)
      .order('started_at', { ascending: false })
      .limit(limit)
    if (error) fail('Nie udało się pobrać projektów', error)
    return data.map((row) => ({
      id: row.id,
      title: row.title,
      stepIndex: row.step_index ?? 0,
      stepsTotal: row.steps_total,
      photoPath: row.photo_path as string,
      strokes: (row.final_strokes as Stroke[] | null) ?? [],
      startedAt: row.started_at,
      isDone: row.completed_at !== null,
    }))
  },

  async saveProgress(params: { sessionId: string; stepIndex: number; strokes: Stroke[] }): Promise<void> {
    const { error } = await supabase
      .from('practice_sessions')
      .update({
        step_index: params.stepIndex,
        steps_completed: params.stepIndex,
        final_strokes: params.strokes as unknown as Json,
      })
      .eq('id', params.sessionId)
    if (error) fail('Nie udało się zapisać postępu', error)
  },

  async renameProject(sessionId: string, title: string): Promise<string> {
    const clean = title.trim().slice(0, 200)
    if (!clean) throw new Error('Nazwa nie może być pusta.')
    const { error } = await supabase.from('practice_sessions').update({ title: clean }).eq('id', sessionId)
    if (error) fail('Nie udało się zmienić nazwy', error)
    return clean
  },

  async deleteProject(sessionId: string, photoPath: string | null): Promise<void> {
    // Bez .select('id') PostgREST nie zgłasza błędu, gdy RLS nie dopuści wiersza.
    const { data, error } = await supabase.from('practice_sessions').delete().eq('id', sessionId).select('id')
    if (error) fail('Nie udało się usunąć projektu', error)
    if (data.length === 0) throw new Error('Nie możesz usunąć tego projektu.')
    if (photoPath) await photoService.remove(photoPath).catch((err) => console.error(err))
  },

  async getProject(sessionId: string): Promise<{
    title: string
    photoPath: string | null
    course: unknown[] | null
    stepIndex: number
    strokes: Stroke[]
  } | null> {
    const { data, error } = await supabase
      .from('practice_sessions')
      .select('title, photo_path, course, step_index, final_strokes')
      .eq('id', sessionId)
      .maybeSingle()
    if (error) fail('Nie udało się otworzyć projektu', error)
    if (!data) return null
    return {
      title: data.title,
      photoPath: data.photo_path,
      course: Array.isArray(data.course) ? (data.course as unknown[]) : null,
      stepIndex: data.step_index ?? 0,
      strokes: (data.final_strokes as Stroke[] | null) ?? [],
    }
  },

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
