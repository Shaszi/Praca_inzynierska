export function SettingToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center gap-4 rounded-[18px] border border-line bg-surface p-4">
      <div className="min-w-0 flex-1">
        <p className="m-0 text-[15.5px] font-semibold text-ink">{label}</p>
        <p className="m-0 mt-1 text-[14px] text-ink-soft">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-8 w-14 shrink-0 rounded-full transition ${checked ? 'bg-accent' : 'bg-surface-dim'}`}
      >
        <span
          className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-[left] ${checked ? 'left-7' : 'left-1'}`}
          aria-hidden
        />
      </button>
    </div>
  )
}
