import { animeScanPlan, facesFromAnimeRects, type Face } from './faces'

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
let modelAttempt = 0
let scanSequence = 0

function elapsedMs(started: number) {
  return Math.round((performance.now() - started) * 10) / 10
}

function log(stage: string, started: number, details: Record<string, number | string | boolean> = {}) {
  console.info(`[smart-mirror][anime] ${stage}`, { elapsedMs: elapsedMs(started), ...details })
}

async function initialize() {
  const attempt = ++modelAttempt
  const totalStarted = performance.now()
  console.info('[smart-mirror][anime] 模型加载开始', { attempt })
  // OpenCV stays in its own lazy chunk; photo detection does not download it.
  let started = performance.now()
  const cvModule = (await import('@techstark/opencv-js') as unknown as { default: AnimeCv | Promise<AnimeCv> }).default
  log('OpenCV.js 下载并解析', started, { attempt })
  started = performance.now()
  let cv: AnimeCv
  if (cvModule instanceof Promise) {
    cv = await cvModule
  } else {
    cv = cvModule
    if (!cv.Mat) await new Promise<void>((resolve) => { cv.onRuntimeInitialized = resolve })
  }
  log('OpenCV 运行时初始化', started, { attempt })

  started = performance.now()
  const response = await fetch(`${import.meta.env.BASE_URL}anime-model/${MODEL_NAME}`)
  if (!response.ok) throw new Error('动漫人脸模型加载失败')
  const modelBytes = new Uint8Array(await response.arrayBuffer())
  log('级联模型下载', started, { attempt, bytes: modelBytes.byteLength })
  started = performance.now()
  if (!cv.FS.analyzePath(`/${MODEL_NAME}`).exists) {
    cv.FS_createDataFile('/', MODEL_NAME, modelBytes, true, false, false)
  }
  const cascade = new cv.CascadeClassifier()
  if (!cascade.load(MODEL_NAME) || cascade.empty()) {
    cascade.delete()
    throw new Error('动漫人脸模型无效')
  }
  log('级联模型初始化', started, { attempt })
  log('模型加载完成', totalStarted, { attempt })
  return { cv, cascade }
}

export function loadAnimeDetector() {
  if (!runtime) runtime = initialize().catch((error: unknown) => {
    console.error('[smart-mirror][anime] 模型加载失败', error)
    runtime = null
    throw error
  })
  return runtime
}

export async function detectAnimeFaces(
  image: HTMLImageElement,
  isCurrent: () => boolean,
  quality: 'fast' | 'detail' = 'fast',
  onScanStart?: () => void,
  runId?: number,
): Promise<Face[]> {
  const scanId = ++scanSequence
  const totalStarted = performance.now()
  let started = performance.now()
  const { cv, cascade } = await loadAnimeDetector()
  log('等待模型就绪', started, { scanId, runId: runId ?? 0, quality })
  if (!isCurrent()) {
    log('扫描取消', totalStarted, { scanId, runId: runId ?? 0 })
    return []
  }
  onScanStart?.()
  await new Promise<void>((resolve) => window.setTimeout(resolve, 0))
  if (!isCurrent()) {
    log('扫描取消', totalStarted, { scanId, runId: runId ?? 0 })
    return []
  }

  const plan = animeScanPlan(image.naturalWidth, image.naturalHeight, quality)
  console.info('[smart-mirror][anime] 扫描参数', {
    scanId, runId: runId ?? 0, quality,
    sourceWidth: image.naturalWidth, sourceHeight: image.naturalHeight,
    scanWidth: plan.width, scanHeight: plan.height, scaleFactor: plan.scaleFactor,
  })
  started = performance.now()
  const canvas = document.createElement('canvas')
  canvas.width = plan.width
  canvas.height = plan.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('无法创建检测画布')
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  log('图像缩放与画布准备', started, { scanId, runId: runId ?? 0 })

  let source: CvMat | undefined
  let gray: CvMat | undefined
  let rectangles: CvRectVector | undefined
  try {
    started = performance.now()
    source = cv.imread(canvas)
    gray = new cv.Mat()
    rectangles = new cv.RectVector()
    log('像素读取', started, { scanId, runId: runId ?? 0 })
    started = performance.now()
    cv.cvtColor(source, gray, cv.COLOR_RGBA2GRAY)
    cv.equalizeHist(gray, gray)
    log('灰度与直方图预处理', started, { scanId, runId: runId ?? 0 })
    started = performance.now()
    console.info('[smart-mirror][anime] 多尺度扫描开始', { scanId, runId: runId ?? 0 })
    cascade.detectMultiScale(gray, rectangles, plan.scaleFactor, 3, 0,
      new cv.Size(24, 24), new cv.Size(0, 0))
    log('多尺度扫描完成', started, { scanId, runId: runId ?? 0, boxes: rectangles.size() })
    started = performance.now()
    const found: CvRect[] = []
    for (let i = 0; i < rectangles.size(); i++) found.push(rectangles.get(i))
    const faces = facesFromAnimeRects(found, image.naturalWidth / canvas.width,
      image.naturalHeight / canvas.height, image.naturalWidth)
    log('坐标映射', started, { scanId, runId: runId ?? 0, faces: faces.length })
    log('本次二次元检测总耗时', totalStarted, { scanId, runId: runId ?? 0, faces: faces.length })
    return faces
  } catch (error) {
    console.error('[smart-mirror][anime] 扫描失败', { scanId, runId: runId ?? 0, elapsedMs: elapsedMs(totalStarted), error })
    throw error
  } finally {
    rectangles?.delete()
    gray?.delete()
    source?.delete()
    canvas.width = 0
    canvas.height = 0
  }
}
