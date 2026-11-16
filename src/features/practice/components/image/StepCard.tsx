import type { ImageGuideStep } from '../../../../services/aiImageGuide'

export function StepCard({ steps, stepIndex }: { steps: ImageGuideStep[]; stepIndex: number }) {
  const step = steps[stepIndex] ?? null
  const partSteps = step?.part ? steps.filter((item) => item.part?.id === step.part!.id) : []
  const inPart = step ? partSteps.indexOf(step) + 1 : 0

  return (
    <section className="flex flex-col gap-2 rounded-[22px] border border-line bg-surface p-[18px]">
      <h3 className="text-[15px] font-semibold text-ink-faint">
        Krok {stepIndex + 1} z {steps.length}
      </h3>
      {step?.part && (
        <p className="m-0 text-[14px] text-ink-soft">
          Teraz rysujemy: <b className="text-ink">{step.part.name}</b>
          {partSteps.length > 1 && (
            <span className="text-ink-faint">
              {' '}
              · fragment {inPart} z {partSteps.length}
            </span>
          )}
        </p>
      )}
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
            } ${index > 0 && item.part?.id !== steps[index - 1].part?.id ? 'ml-1.5' : ''}`}
          />
        ))}
      </div>
    </section>
  )
}
