import { InteractiveSegmenterLegacy } from '@mediapipe/tasks-vision'
import { lazy, MODELS, VISION_FILES } from './mediapipeFiles'
import { maskFromCategory, type SubjectMask } from './subjectMask'

const getSegmenter = lazy(() =>
  InteractiveSegmenterLegacy.createFromOptions(VISION_FILES, {
    baseOptions: { modelAssetPath: MODELS.magicTouch },
    outputCategoryMask: true,
    outputConfidenceMasks: false,
  }),
)

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
