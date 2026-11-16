import { FaceLandmarker, ImageSegmenter } from '@mediapipe/tasks-vision'
import { lazy, MODELS, VISION_FILES } from '../mediapipeFiles'
import type { CategoryMask } from './assembleParts'
import { faceParts, type Part } from './faceParts'

const getFaceLandmarker = lazy(() =>
  FaceLandmarker.createFromOptions(VISION_FILES, {
    baseOptions: { modelAssetPath: MODELS.faceLandmarker },
    numFaces: 1,
  }),
)

const getPersonSegmenter = lazy(() =>
  ImageSegmenter.createFromOptions(VISION_FILES, {
    baseOptions: { modelAssetPath: MODELS.selfieMulticlass },
    outputCategoryMask: true,
    outputConfidenceMasks: false,
  }),
)

const SETS = {
  oval: FaceLandmarker.FACE_LANDMARKS_FACE_OVAL,
  leftEyebrow: FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW,
  rightEyebrow: FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW,
  leftEye: FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
  rightEye: FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
  leftIris: FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS,
  rightIris: FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS,
  lips: FaceLandmarker.FACE_LANDMARKS_LIPS,
}

/** Twarz (części z punktów siatki) i mapa włosy/skóra/ubranie. Null, gdy na zdjęciu nie ma twarzy. */
export async function detectPerson(
  image: HTMLImageElement,
  width: number,
  height: number,
): Promise<{ face: Part[]; faceCenter: { x: number; y: number }; categories: CategoryMask | null } | null> {
  const landmarks = (await getFaceLandmarker()).detect(image).faceLandmarks[0]
  if (!landmarks) return null

  let categories: CategoryMask | null = null
  try {
    const result = (await getPersonSegmenter()).segment(image)
    const mask = result.categoryMask
    if (mask) categories = { data: mask.getAsUint8Array(), width: mask.width, height: mask.height }
    result.close()
  } catch (error) {
    // Bez mapy włosów kurs nadal ma całą twarz — tylko bez kosmyków i sylwetki.
    console.error(error)
  }

  const faceCenter = {
    x: (landmarks.reduce((sum, p) => sum + p.x, 0) / landmarks.length) * width,
    y: (landmarks.reduce((sum, p) => sum + p.y, 0) / landmarks.length) * height,
  }
  return { face: faceParts(landmarks, width, height, SETS), faceCenter, categories }
}
