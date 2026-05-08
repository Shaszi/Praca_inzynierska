type ReferenceOverlayProps = {
  hasReference: boolean
}

export function ReferenceOverlay({ hasReference }: ReferenceOverlayProps) {
  if (!hasReference) {
    return null
  }

  return (
    <div className="pointer-events-none absolute left-3 top-3 z-20 rounded-md bg-sky-100/80 px-2 py-1 text-xs font-medium text-sky-700">
      Guide reference loaded
    </div>
  )
}
