import { animeScanPlan, facesFromAnimeRects, type Face } from './faces'
import opencvScriptUrl from '@techstark/opencv-js/dist/opencv.js?url'

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
let cvScript: Promise<{ cv: AnimeCv }> | null = null
let modelAttempt = 0
let scanSequence = 0

function elapsedMs(started: number) {
  return Math.round((performance.now() - started) * 10) / 10
}

function log(stage: string, started: number, details: Record<string, number | string | boolean> = {}) {
  console.info(`[smart-mirror][anime] ${stage}`, { elapsedMs: elapsedMs(started), ...details })
}

function loadOpenCvScript(attempt: number): Promise<{ cv: AnimeCv }> {
  const existing = (window as Window & { cv?: AnimeCv }).cv
  if (existing?.Mat) return Promise.resolve({ cv: existing })
  if (cvScript) return cvScript

  cvScript = new Promise<{ cv: AnimeCv }>((resolve, reject) => {
    const downloadStarted = performance.now()
    const script = document.createElement('script')
    let runtimeTimer = 0
    let pollTimer = 0
    let settled = false

    function finish(error?: Error, cv?: AnimeCv) {
      if (settled) return
      settled = true
      window.clearTimeout(downloadTimer)
      window.clearTimeout(runtimeTimer)
      window.clearInterval(pollTimer)
      script.onload = null
      script.onerror = null
      if (error) {
        script.remove()
        reject(error)
      } else if (cv) {
        resolve({ cv })
      }
    }

    const downloadTimer = window.setTimeout(() => {
      finish(new Error('OpenCV.js 下载超时，请检查网络后重试'))
    }, 45_000)

    script.async = true
    script.src = opencvScriptUrl
    script.onerror = () => finish(new Error('OpenCV.js 下载失败，请检查网络后重试'))
    script.onload = () => {
      log('OpenCV.js 下载并解析', downloadStarted, { attempt })
      const cv = (window as Window & { cv?: AnimeCv }).cv
      if (!cv) {
        finish(new Error('OpenCV.js 已加载，但未找到运行时'))
        return
      }
      const runtimeStarted = performance.now()
      const ready = () => {
        if (settled || !cv.Mat) return
        log('OpenCV 运行时初始化', runtimeStarted, { attempt })
        finish(undefined, cv)
      }
      if (cv.Mat) {
        ready()
      } else {
        const previous = cv.onRuntimeInitialized
        cv.onRuntimeInitialized = () => { try { previous?.() } finally { ready() } }
        pollTimer = window.setInterval(ready, 100)
        runtimeTimer = window.setTimeout(() => {
          finish(new Error('OpenCV 运行时初始化超时，请刷新后重试'))
        }, 20_000)
      }
    }
    document.head.append(script)
  }).catch((error: unknown) => {
    cvScript = null
    throw error
  })
  return cvScript
}

async function initialize() {
  const attempt = ++modelAttempt
  const totalStarted = performance.now()
  console.info('[smart-mirror][anime] 模型加载开始', { attempt })
  const { cv } = await loadOpenCvScript(attempt)

  let started = performance.now()
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
