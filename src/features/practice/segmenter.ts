import { InteractiveSegmenterLegacy } from '@mediapipe/tasks-vision'
import wasmLoaderPath from '@mediapipe/tasks-vision/vision_wasm_internal.js?url'
import wasmBinaryPath from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url'
import { maskFromCategory, type SubjectMask } from './subjectMask'

// shortcut: model z CDN Google — przy pracy offline trzeba go wrzucić do public/ i podmienić ścieżkę.
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/interactive_segmenter/magic_touch/float32/1/magic_touch.tflite'

let segmenter: Promise<InteractiveSegmenterLegacy> | null = null

function getSegmenter(): Promise<InteractiveSegmenterLegacy> {
  segmenter ??= InteractiveSegmenterLegacy.createFromOptions(
    { wasmLoaderPath, wasmBinaryPath },
    { baseOptions: { modelAssetPath: MODEL_URL }, outputCategoryMask: true, outputConfidenceMasks: false },
  )
  segmenter.catch(() => {
    segmenter = null
  })
  return segmenter
}

export async function segmentAt(image: HTMLImageElement, x: number, y: number): Promise<SubjectMask> {
  const task = await getSegmenter()
  const result = task.segment(image, { keypoint: { x, y } })
  try {
    const category = result.categoryMask
    if (!category) throw new Error('Segmenter nie zwrócił maski.')
    return maskFromCategory(category.getAsUint8Array(), category.width, category.height, x, y)
  } finally {
    result.close()
  }
}
