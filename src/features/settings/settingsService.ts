import type { Json } from '../../lib/database.types'
import { supabase } from '../../lib/supabase'
import { parseSettings, type AppSettings } from './settingsModel'

export const settingsService = {
  /** Ustawienia konta albo `null`, gdy konto jeszcze ich nie zapisało. */
  async load(): Promise<AppSettings | null> {
    const { data, error } = await supabase.from('user_settings').select('settings').maybeSingle()
    if (error) throw new Error(`Nie udało się pobrać ustawień: ${error.message}`)
    return data ? parseSettings(data.settings) : null
  },

  async save(userId: string, settings: AppSettings): Promise<void> {
    const { error } = await supabase
      .from('user_settings')
      .upsert({ user_id: userId, settings: settings as unknown as { [key: string]: Json } }, { onConflict: 'user_id' })
    if (error) throw new Error(`Nie udało się zapisać ustawień: ${error.message}`)
  },
}
