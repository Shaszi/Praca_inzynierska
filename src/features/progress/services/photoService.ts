import { supabase } from '../../../lib/supabase'

const BUCKET = 'practice-photos'
/**
 * Dłuższy bok po zmniejszeniu. Kontury i tak liczymy z oryginału w pamięci, a do
 * wyświetlenia pod rysunkiem 1600 px wystarcza z zapasem. Zdjęcie z telefonu waży
 * kilkanaście megabajtów i zjadłoby darmowy limit Storage po kilkudziesięciu projektach.
 */
const MAX_SIDE = 1600
const JPEG_QUALITY = 0.82

/** Zmniejsza zdjęcie do JPEG-a. Mniejsze od limitu zostaje w swoich wymiarach. */
export function downscaleToJpeg(image: HTMLImageElement): Promise<Blob> {
  const scale = Math.min(1, MAX_SIDE / Math.max(image.naturalWidth, image.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(image.naturalWidth * scale)
  canvas.height = Math.round(image.naturalHeight * scale)
  const context = canvas.getContext('2d')
  if (!context) return Promise.reject(new Error('Przeglądarka nie dała kontekstu 2D.'))
  context.drawImage(image, 0, 0, canvas.width, canvas.height)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Nie udało się przygotować zdjęcia.'))),
      'image/jpeg',
      JPEG_QUALITY,
    )
  })
}

export const photoService = {
  /**
   * Ścieżka zaczyna się od id właściciela, bo na tym opiera się polityka Storage —
   * jedno porównanie zamiast zaglądania do tabeli sesji przy każdym pliku.
   */
  async upload(blob: Blob): Promise<string> {
    const { data } = await supabase.auth.getSession()
    const userId = data.session?.user.id
    if (!userId) throw new Error('Trzeba być zalogowanym, żeby zapisać zdjęcie.')

    const path = `${userId}/${crypto.randomUUID()}.jpg`
    const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg' })
    if (error) throw new Error('Nie udało się zapisać zdjęcia projektu.')
    return path
  },

  /** Bucket jest prywatny, więc do pokazania zdjęcia potrzebny jest podpisany adres. */
  async signedUrl(path: string, secondsValid = 60 * 60): Promise<string | null> {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, secondsValid)
    return error ? null : data.signedUrl
  },

  async remove(path: string): Promise<void> {
    await supabase.storage.from(BUCKET).remove([path])
  },
}
