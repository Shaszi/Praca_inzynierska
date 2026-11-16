export function SettingSlider({
  label,
  description,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string
  description: string
  value: number
  min: number
  max: number
  step: number
  format: (value: number) => string
  onChange: (value: number) => void
}) {
  return (
    <label className="flex flex-col gap-2 rounded-[18px] border border-line bg-surface p-4">
      <span className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 text-[15.5px] font-semibold text-ink">{label}</span>
        <span className="font-mono text-[14px] text-ink-soft">{format(value)}</span>
      </span>
      <span className="text-[14px] text-ink-soft">{description}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full"
      />
    </label>
  )
}
