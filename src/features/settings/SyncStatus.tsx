import type { SettingsSync } from './settingsContext'

const TEXT: Record<SettingsSync, string> = {
  local: 'Wczytuję ustawienia z konta…',
  saving: 'Zapisuję na koncie…',
  saved: 'Zapisane na koncie.',
  error: 'Nie udało się połączyć z kontem — zmiany działają na tym urządzeniu i zapiszą się przy następnej zmianie.',
}

export function SyncStatus({ sync }: { sync: SettingsSync }) {
  return (
    <p role="status" className={`m-0 text-[13px] ${sync === 'error' ? 'text-danger' : 'text-ink-faint'}`}>
      {TEXT[sync]}
    </p>
  )
}
