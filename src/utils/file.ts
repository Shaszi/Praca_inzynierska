export function sanitizeFileName(name: string): string {
  const cleaned = name.trim().replace(/[^a-z0-9-]+/gi, '-')
  return cleaned.length > 0 ? cleaned : 'reference'
}

export function downloadJSON(payload: unknown, fileName: string): void {
  const jsonText = JSON.stringify(payload, null, 2)
  const blob = new Blob([jsonText], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()

  URL.revokeObjectURL(url)
}