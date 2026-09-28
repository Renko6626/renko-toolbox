import { facesFromAnimeRects, type Face } from './faces'

interface CvMat { delete(): void }
interface CvRect { x: number; y: number; width: number; height: number }
interface CvRectVector { size(): number; get(index: number): CvRect; delete(): void }
interface CvCascade {
  load(path: string): boolean
  empty(): boolean
  detectMultiScale(image: CvMat, output: CvRectVector, scaleFactor: number, minNeighbors: number,
    flags: number, minSize: unknown, maxSize: unknown): void
  delete(): void
}
interface AnimeCv {
  Mat: new () => CvMat
  RectVector: new () => CvRectVector
  CascadeClassifier: new () => CvCascade
  Size: new (width: number, height: number) => unknown
  COLOR_RGBA2GRAY: number
  imread(source: HTMLCanvasElement): CvMat
  cvtColor(source: CvMat, target: CvMat, code: number): void
  equalizeHist(source: CvMat, target: CvMat): void
  FS: { analyzePath(path: string): { exists: boolean } }
  FS_createDataFile(parent: string, name: string, data: Uint8Array,
    canRead: boolean, canWrite: boolean, canOwn: boolean): void
  onRuntimeInitialized?: () => void
}

const MODEL_NAME = 'lbpcascade_animeface.xml'
let runtime: Promise<{ cv: AnimeCv; cascade: CvCascade }> | null = null

async function initialize() {
  // OpenCV stays in its own lazy chunk; photo detection does not download it.
  const cvModule = (await import('@techstark/opencv-js') as unknown as { default: AnimeCv | Promise<AnimeCv> }).default
  let cv: AnimeCv
  if (cvModule instanceof Promise) {
    cv = await cvModule
  } else {
    cv = cvModule
    if (!cv.Mat) await new Promise<void>((resolve) => { cv.onRuntimeInitialized = resolve })
  }

  const response = await fetch(`${import.meta.env.BASE_URL}anime-model/${MODEL_NAME}`)
  if (!response.ok) throw new Error('动漫人脸模型加载失败')
  if (!cv.FS.analyzePath(`/${MODEL_NAME}`).exists) {
    cv.FS_createDataFile('/', MODEL_NAME, new Uint8Array(await response.arrayBuffer()), true, false, false)
  }
  const cascade = new cv.CascadeClassifier()
  if (!cascade.load(MODEL_NAME) || cascade.empty()) {
    cascade.delete()
    throw new Error('动漫人脸模型无效')
  }
  return { cv, cascade }
}

export async function detectAnimeFaces(image: HTMLImageElement, isCurrent: () => boolean): Promise<Face[]> {
  if (!runtime) runtime = initialize().catch((error: unknown) => {
    runtime = null
    throw error
  })
  const { cv, cascade } = await runtime
  if (!isCurrent()) return []

  const scale = Math.min(1, 1280 / Math.max(image.naturalWidth, image.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('无法创建检测画布')
  context.drawImage(image, 0, 0, canvas.width, canvas.height)

  let source: CvMat | undefined
  let gray: CvMat | undefined
  let rectangles: CvRectVector | undefined
  try {
    source = cv.imread(canvas)
    gray = new cv.Mat()
    rectangles = new cv.RectVector()
    cv.cvtColor(source, gray, cv.COLOR_RGBA2GRAY)
    cv.equalizeHist(gray, gray)
    cascade.detectMultiScale(gray, rectangles, 1.1, 3, 0, new cv.Size(24, 24), new cv.Size(0, 0))
    const found: CvRect[] = []
    for (let i = 0; i < rectangles.size(); i++) found.push(rectangles.get(i))
    return facesFromAnimeRects(found, image.naturalWidth / canvas.width,
      image.naturalHeight / canvas.height, image.naturalWidth)
  } finally {
    rectangles?.delete()
    gray?.delete()
    source?.delete()
    canvas.width = 0
    canvas.height = 0
  }
}
