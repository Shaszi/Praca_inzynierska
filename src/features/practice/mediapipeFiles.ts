import wasmLoaderPath from '@mediapipe/tasks-vision/vision_wasm_internal.js?url'
import wasmBinaryPath from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url'

export const VISION_FILES = { wasmLoaderPath, wasmBinaryPath }

// shortcut: modele z CDN Google — przy pracy offline trzeba je wrzucić do public/ i podmienić ścieżki.
export const MODELS = {
  magicTouch:
    'https://storage.googleapis.com/mediapipe-models/interactive_segmenter/magic_touch/float32/1/magic_touch.tflite',
  faceLandmarker:
    'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
  selfieMulticlass:
    'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite',
}

/** Leniwie ładowany model, który po nieudanej próbie da się załadować ponownie. */
export function lazy<T>(load: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | null = null
  return () => {
    pending ??= load()
    pending.catch(() => {
      pending = null
    })
    return pending
  }
}
