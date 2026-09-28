import { FaceDetector } from '@mediapipe/tasks-vision'
import wasmLoaderUrl from '@mediapipe/tasks-vision/vision_wasm_internal.js?url'
import wasmBinaryUrl from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url'
import { facesFromDetections, mergeFaces, type Face } from './faces'

export async function loadFaceDetector(): Promise<FaceDetector> {
  return FaceDetector.createFromOptions({
    wasmLoaderPath: wasmLoaderUrl,
    wasmBinaryPath: wasmBinaryUrl,
  }, {
    baseOptions: {
      modelAssetPath: `${import.meta.env.BASE_URL}face-model/blaze_face_full_range.tflite`,
      delegate: 'CPU',
    },
    runningMode: 'IMAGE',
    minDetectionConfidence: 0.5,
  })
}

/** Scan the whole photo and, for large photos, overlapping regions for smaller faces. */
export async function detectFaces(
  detector: FaceDetector,
  image: HTMLImageElement,
  isCurrent: () => boolean,
): Promise<Face[]> {
  const width = image.naturalWidth
  const height = image.naturalHeight
  const found = facesFromDetections(detector.detect(image).detections,
    { width, height, offsetX: 0, offsetY: 0 }, width)

  const tileWidth = width > 1400 ? Math.ceil(width * 0.6) : width
  const tileHeight = height > 1400 ? Math.ceil(height * 0.6) : height
  const xs = tileWidth < width ? [0, width - tileWidth] : [0]
  const ys = tileHeight < height ? [0, height - tileHeight] : [0]
  if (xs.length === 1 && ys.length === 1) return mergeFaces(found)

  const tile = document.createElement('canvas')
  const context = tile.getContext('2d')
  if (!context) throw new Error('无法创建检测画布')

  for (const y of ys) {
    for (const x of xs) {
      if (!isCurrent()) return []
      const scale = Math.min(1, 1024 / Math.max(tileWidth, tileHeight))
      tile.width = Math.max(1, Math.round(tileWidth * scale))
      tile.height = Math.max(1, Math.round(tileHeight * scale))
      context.drawImage(image, x, y, tileWidth, tileHeight, 0, 0, tile.width, tile.height)
      found.push(...facesFromDetections(detector.detect(tile).detections, {
        width: tile.width,
        height: tile.height,
        offsetX: x,
        offsetY: y,
        scaleX: tileWidth / tile.width,
        scaleY: tileHeight / tile.height,
      }, width))
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0))
    }
  }

  tile.width = 0
  tile.height = 0
  return mergeFaces(found)
}
