import type { SupportedMediaType } from '../../../services/aiImageGuide'

export const ACCEPTED_TYPES: SupportedMediaType[] = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export function readFileAsBase64(file: File): Promise<{ base64: string; mediaType: SupportedMediaType }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve({ base64: result.split(',')[1], mediaType: file.type as SupportedMediaType })
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export type LoadedPhoto = { pixels: Uint8ClampedArray; width: number; height: number; image: HTMLImageElement }

/** Zdjęcie przez płótno: stamtąd biorą się piksele dla detekcji konturów. */
export async function readPixels(url: string): Promise<LoadedPhoto> {
  const image = new Image()
  image.src = url
  await image.decode()
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('Przeglądarka nie dała kontekstu 2D.')
  context.drawImage(image, 0, 0)
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
  return { pixels: data, width: canvas.width, height: canvas.height, image }
}
