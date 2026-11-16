import { Button } from '../../../components/ui'

export function NextStepButton({ isLast, label, onClick }: { isLast: boolean; label: string; onClick: () => void }) {
  return (
    <Button variant="primary" className="absolute right-3 bottom-3 z-10 shadow-lg" onClick={onClick}>
      {isLast ? 'Zakończ' : label}
    </Button>
  )
}
