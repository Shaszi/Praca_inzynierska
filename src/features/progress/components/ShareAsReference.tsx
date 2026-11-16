import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../../components/ui'
import { referenceStorageService } from '../../teacher/services/referenceStorageService'
import type { Stroke } from '../../../types/drawing'

export function ShareAsReference({ title, strokes }: { title: string; strokes: Stroke[] }) {
  const [isOpen, setIsOpen] = useState(false)
  const [name, setName] = useState(title)
  const [toLibrary, setToLibrary] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const guideStrokes = strokes.filter((stroke) => stroke.points.length >= 2)

  if (done) {
    return (
      <p role="status" className="text-[13px] text-ink-soft">
        {done}{' '}
        <Link to="/app/library" className="font-semibold text-accent underline-offset-2 hover:underline">
          Biblioteka
        </Link>
      </p>
    )
  }

  if (!isOpen) {
    return (
      <Button variant="ghost" size="sm" disabled={guideStrokes.length === 0} onClick={() => setIsOpen(true)}>
        Udostępnij jako wzorzec
      </Button>
    )
  }

  const save = async () => {
    const clean = name.trim()
    if (!clean) return setError('Nazwa nie może być pusta.')
    setIsSaving(true)
    setError(null)
    const { data, error: insertError } = await referenceStorageService.insertReference(clean, guideStrokes)
    if (insertError || !data) {
      setError(insertError ?? 'Nie udało się zapisać wzorca.')
      setIsSaving(false)
      return
    }
    const submitError = toLibrary ? await referenceStorageService.submitForReview(data.id) : null
    setIsSaving(false)
    setDone(
      submitError
        ? 'Wzorzec zapisany w Twoich wzorcach, ale zgłoszenie się nie udało — zgłoś go w bibliotece.'
        : toLibrary
          ? 'Wzorzec czeka na sprawdzenie przez moderatora. Po akceptacji zobaczą go inni.'
          : 'Zapisano w Twoich wzorcach.',
    )
  }

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
    >
      <label className="flex flex-col gap-1 text-[13px] font-medium text-ink-soft">
        Nazwa wzorca
        <input
          autoFocus
          maxLength={120}
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="min-h-9 w-full rounded-full border border-ink-faint bg-surface px-3 text-[14.5px] text-ink focus:border-accent focus:outline-none"
        />
      </label>
      <label className="flex items-center gap-2 text-[13px] text-ink-soft">
        <input type="checkbox" checked={toLibrary} onChange={(event) => setToLibrary(event.target.checked)} />
        Zgłoś do biblioteki dla innych (po sprawdzeniu przez moderatora)
      </label>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" size="sm" className="flex-1" disabled={isSaving}>
          {isSaving ? 'Zapisuję…' : 'Zapisz wzorzec'}
        </Button>
        <Button variant="ghost" size="sm" disabled={isSaving} onClick={() => setIsOpen(false)}>
          Anuluj
        </Button>
      </div>
      {error && (
        <small role="alert" className="text-[12.5px] text-danger">
          {error}
        </small>
      )}
    </form>
  )
}
