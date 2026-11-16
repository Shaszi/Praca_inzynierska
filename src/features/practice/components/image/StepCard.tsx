import type { ImageGuideStep } from '../../../../services/aiImageGuide'

export function StepCard({ steps, stepIndex }: { steps: ImageGuideStep[]; stepIndex: number }) {
  const step = steps[stepIndex] ?? null
  return (
    <section className="flex flex-col gap-2 rounded-[22px] border border-line bg-surface p-[18px]">
      <h3 className="text-[15px] font-semibold text-ink-faint">
        Krok {stepIndex + 1} z {steps.length}
      </h3>
      {step && (
        <>
          <strong className="font-display text-[20px] leading-[1.15] font-bold">{step.title}</strong>
          <p className="text-[15px] text-ink-soft">{step.description}</p>
        </>
      )}
      <div className="mt-1 flex flex-wrap gap-[3px]" aria-hidden>
        {steps.map((item, index) => (
          <span
            key={item.id}
            className={`h-1.5 rounded-full transition-all ${
              index < stepIndex ? 'w-4 bg-success' : index === stepIndex ? 'w-[26px] bg-accent' : 'w-4 bg-surface-dim'
            }`}
          />
        ))}
      </div>
    </section>
  )
}
