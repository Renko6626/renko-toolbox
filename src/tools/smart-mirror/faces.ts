export interface Face {
  x: number
  y: number
  width: number
  height: number
  axis: number
  score: number
}

interface FaceDetection {
  boundingBox?: { originX: number; originY: number; width: number; height: number }
  keypoints: { x: number; y: number }[]
  categories: { score: number }[]
}

interface Frame {
  width: number
  height: number
  offsetX: number
  offsetY: number
  scaleX?: number
  scaleY?: number
}

export function facesFromDetections(detections: FaceDetection[], frame: Frame, imageWidth: number): Face[] {
  const scaleX = frame.scaleX ?? 1
  const scaleY = frame.scaleY ?? 1
  return detections.flatMap((detection) => {
    const box = detection.boundingBox
    if (!box || box.width <= 0 || box.height <= 0) return []

    const [rightEye, leftEye, nose] = detection.keypoints
    const landmarkX = rightEye && leftEye && nose &&
      [rightEye.x, leftEye.x, nose.x].every(Number.isFinite)
      ? ((rightEye.x + leftEye.x) / 2 + nose.x) / 2 * frame.width
      : box.originX + box.width / 2
    const x = frame.offsetX + box.originX * scaleX
    const y = frame.offsetY + box.originY * scaleY
    const rawAxis = frame.offsetX + landmarkX * scaleX
    const axis = Math.min(imageWidth - 0.5, Math.max(0.5, Math.round(rawAxis * 2) / 2))

    return [{
      x, y, width: box.width * scaleX, height: box.height * scaleY, axis,
      score: detection.categories[0]?.score ?? 0,
    }]
  })
}

function overlapRatio(a: Face, b: Face): number {
  const overlapWidth = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x))
  const overlapHeight = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y))
  const intersection = overlapWidth * overlapHeight
  return intersection / (a.width * a.height + b.width * b.height - intersection)
}

export function mergeFaces(faces: Face[]): Face[] {
  const kept: Face[] = []
  for (const face of [...faces].sort((a, b) => b.score - a.score)) {
    if (kept.every((other) => overlapRatio(face, other) < 0.5)) kept.push(face)
  }
  return kept.sort((a, b) => a.x - b.x || a.y - b.y)
}
