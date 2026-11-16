import { supabase } from '../../../lib/supabase'

const BUCKET = 'practice-photos'
const MAX_SIDE = 1600
const JPEG_QUALITY = 0.82

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
  async upload(blob: Blob): Promise<string> {
    const { data } = await supabase.auth.getSession()
    const userId = data.session?.user.id
    if (!userId) throw new Error('Trzeba być zalogowanym, żeby zapisać zdjęcie.')

    const path = `${userId}/${crypto.randomUUID()}.jpg`
    const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg' })
    if (error) throw new Error('Nie udało się zapisać zdjęcia projektu.')
    return path
  },

  async signedUrl(path: string, secondsValid = 60 * 60): Promise<string | null> {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, secondsValid)
    return error ? null : data.signedUrl
  },

  async remove(path: string): Promise<void> {
    await supabase.storage.from(BUCKET).remove([path])
  },
}
