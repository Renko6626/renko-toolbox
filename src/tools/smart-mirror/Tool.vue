<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef, watch } from 'vue'
import type { FaceDetector } from '@mediapipe/tasks-vision'
import { NButton, useMessage } from 'naive-ui'
import { mirrorSegments } from '../mirror/geometry'
import { detectFaces, loadFaceDetector } from './detector'
import type { Face } from './faces'
import { useImageImport } from '../mirror/useImageImport'

type Direction = 'left' | 'right'

const message = useMessage()
const source = shallowRef<HTMLImageElement | null>(null)
const sourceUrl = ref('')
const filename = ref('')
const faces = ref<Face[]>([])
const selectedFace = ref<number | null>(null)
const detecting = ref(false)
const detectionError = ref('')
const renderError = ref('')
const axis = ref(0.5)
const direction = ref<Direction>('left')
const canvas = ref<HTMLCanvasElement | null>(null)

const sourceWidth = computed(() => source.value?.naturalWidth ?? 0)
const sourceHeight = computed(() => source.value?.naturalHeight ?? 0)
const outputWidth = computed(() => source.value
  ? mirrorSegments(sourceWidth.value, axis.value, direction.value).outputWidth
  : 0)
const axisPercent = computed(() => `${axis.value / sourceWidth.value * 100}%`)
const sourceFrameWidth = computed(() => `min(100%, ${sourceWidth.value}px, ${70 * sourceWidth.value / sourceHeight.value}vh)`)

let loadVersion = 0
let frame = 0
let detectorPromise: Promise<FaceDetector> | null = null
let axisTouched = false

function getDetector() {
  if (!detectorPromise) detectorPromise = loadFaceDetector()
  return detectorPromise
}

async function loadFile(file: File) {
  const version = ++loadVersion
  const url = URL.createObjectURL(file)
  const image = new Image()
  image.src = url

  try {
    await image.decode()
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('无法读取图片尺寸')
    if (version !== loadVersion) {
      URL.revokeObjectURL(url)
      return
    }
  } catch {
    URL.revokeObjectURL(url)
    if (version === loadVersion) message.error('无法打开这张图片，请换一张试试')
    return
  }

  const oldUrl = sourceUrl.value
  axis.value = image.naturalWidth / 2
  axisTouched = false
  faces.value = []
  selectedFace.value = null
  filename.value = file.name
  sourceUrl.value = url
  source.value = image
  detectionError.value = ''
  renderError.value = ''
  detecting.value = true
  if (oldUrl) URL.revokeObjectURL(oldUrl)

  try {
    const detector = await getDetector()
    if (version !== loadVersion) return
    const found = await detectFaces(detector, image, () => version === loadVersion)
    if (version !== loadVersion) return

    faces.value = found
    if (found.length && !axisTouched) {
      const largest = found.reduce((best, face, index) =>
        face.width * face.height > found[best].width * found[best].height ? index : best, 0)
      selectFace(largest)
    }
  } catch {
    if (version === loadVersion) {
      detectorPromise = null
      detectionError.value = '人脸检测未能完成；仍可手动移动对称轴。'
    }
  } finally {
    if (version === loadVersion) detecting.value = false
  }
}

const { chooseFile, pasteFromClipboard } = useImageImport(loadFile, (text) => message.warning(text))

function selectFace(index: number) {
  axisTouched = true
  selectedFace.value = index
  axis.value = faces.value[index].axis
}

function setAxis(event: Event) {
  axisTouched = true
  axis.value = Number((event.target as HTMLInputElement).value)
  selectedFace.value = null
}

function faceBoxStyle(face: Face) {
  const left = Math.max(0, face.x)
  const top = Math.max(0, face.y)
  const right = Math.min(sourceWidth.value, face.x + face.width)
  const bottom = Math.min(sourceHeight.value, face.y + face.height)
  return {
    left: `${left / sourceWidth.value * 100}%`,
    top: `${top / sourceHeight.value * 100}%`,
    width: `${Math.max(0, right - left) / sourceWidth.value * 100}%`,
    height: `${Math.max(0, bottom - top) / sourceHeight.value * 100}%`,
  }
}

function faceAxisStyle(face: Face) {
  const clippedLeft = Math.max(0, face.x)
  const clippedWidth = Math.max(1, Math.min(sourceWidth.value, face.x + face.width) - clippedLeft)
  return { left: `${Math.min(100, Math.max(0, (face.axis - clippedLeft) / clippedWidth * 100))}%` }
}

function render() {
  frame = 0
  const image = source.value
  const target = canvas.value
  if (!image || !target) return

  try {
    const plan = mirrorSegments(image.naturalWidth, axis.value, direction.value)
    target.width = plan.outputWidth
    target.height = image.naturalHeight
    const context = target.getContext('2d')
    if (!context) throw new Error('无法创建画布')

    for (const segment of plan.segments) {
      if (!segment.width) continue
      context.save()
      if (segment.flip) {
        context.translate(segment.targetX + segment.width, 0)
        context.scale(-1, 1)
        context.drawImage(image, segment.sourceX, 0, segment.width, image.naturalHeight,
          0, 0, segment.width, image.naturalHeight)
      } else {
        context.drawImage(image, segment.sourceX, 0, segment.width, image.naturalHeight,
          segment.targetX, 0, segment.width, image.naturalHeight)
      }
      context.restore()
    }
    renderError.value = ''
  } catch {
    renderError.value = '图片太大或当前浏览器无法绘制，请换一张较小的图片。'
  }
}

function scheduleRender() {
  if (frame) cancelAnimationFrame(frame)
  frame = requestAnimationFrame(render)
}

watch([source, axis, direction], scheduleRender, { flush: 'post' })

function download() {
  if (!canvas.value) return
  if (frame) cancelAnimationFrame(frame)
  render()
  if (renderError.value) return

  const name = filename.value.replace(/\.[^.]+$/, '') || 'image'
  const selectedDirection = direction.value
  try {
    canvas.value.toBlob((blob) => {
      if (!blob) {
        message.error('导出失败，请换一张较小的图片')
        return
      }
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${name}-face-mirror-${selectedDirection}.png`
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    }, 'image/png')
  } catch {
    message.error('导出失败，请换一张图片试试')
  }
}

onUnmounted(() => {
  loadVersion++
  if (frame) cancelAnimationFrame(frame)
  if (sourceUrl.value) URL.revokeObjectURL(sourceUrl.value)
  detectorPromise?.then((detector) => detector.close()).catch(() => {})
})
</script>

<template>
  <section class="smart-mirror">
    <div class="toolbar">
      <div class="toolbar-copy">
        <p class="eyebrow">图片来源</p>
        <p class="toolbar-title">选择或粘贴一张照片</p>
      </div>
      <div class="toolbar-actions">
        <label class="file-button">
          选择照片 / 相册
          <input type="file" accept="image/*" aria-label="选择照片或从相册选取" @change="chooseFile" />
        </label>
        <NButton @click="pasteFromClipboard">粘贴图片</NButton>
      </div>
      <span class="privacy">也可按 Ctrl/⌘+V 粘贴；图片和人脸检测都在浏览器里完成。</span>
    </div>

    <template v-if="source">
      <div class="controls">
        <div class="face-picker">
          <p class="eyebrow">识别到的人脸</p>
          <p v-if="detecting" class="status" role="status">正在检测人脸…</p>
          <p v-else-if="detectionError" class="status" role="alert">{{ detectionError }}</p>
          <p v-else-if="!faces.length" class="status">没有找到人脸；可以手动设置对称轴。</p>
          <div v-else class="face-buttons">
            <button
              v-for="(face, index) in faces"
              :key="index"
              type="button"
              :aria-pressed="selectedFace === index"
              @click="selectFace(index)"
            >
              人脸 {{ String(index + 1).padStart(2, '0') }} <span class="mono">/ {{ face.axis }} px</span>
            </button>
          </div>
        </div>

        <fieldset class="control">
          <legend class="eyebrow">保留哪一侧</legend>
          <div class="direction-buttons">
            <button type="button" :aria-pressed="direction === 'left'" @click="direction = 'left'">左 → 右</button>
            <button type="button" :aria-pressed="direction === 'right'" @click="direction = 'right'">右 → 左</button>
          </div>
        </fieldset>

        <div class="axis-control control">
          <label for="smart-mirror-axis" class="eyebrow">对称轴 <span class="mono">{{ axis }} px</span></label>
          <input
            id="smart-mirror-axis"
            type="range"
            :value="axis"
            :min="0.5"
            :max="sourceWidth - 0.5"
            step="0.5"
            :disabled="sourceWidth === 1"
            @input="setAxis"
          />
          <div class="range-ends mono"><span>左侧</span><span>右侧</span></div>
        </div>

        <div class="export-control control">
          <p class="dimensions mono">{{ sourceWidth }} × {{ sourceHeight }} → {{ outputWidth }} × {{ sourceHeight }}</p>
          <NButton type="primary" :disabled="!!renderError" @click="download">下载 PNG</NButton>
        </div>
      </div>

      <p v-if="renderError" class="error" role="alert">{{ renderError }}</p>

      <div class="previews">
        <figure>
          <figcaption class="eyebrow">原图 / 人脸与对称轴</figcaption>
          <div class="image-frame" :style="{ width: sourceFrameWidth }">
            <img :src="sourceUrl" :alt="filename" />
            <button
              v-for="(face, index) in faces"
              :key="index"
              type="button"
              class="face-box"
              :class="{ selected: selectedFace === index }"
              :style="faceBoxStyle(face)"
              :aria-label="`选择人脸 ${index + 1} 的对称轴`"
              @click="selectFace(index)"
            >
              <span class="face-midline" :style="faceAxisStyle(face)"></span>
              <span class="face-number mono">{{ index + 1 }}</span>
            </button>
            <span class="axis-line" :style="{ left: axisPercent }" aria-hidden="true"></span>
          </div>
        </figure>
        <figure>
          <figcaption class="eyebrow">处理结果</figcaption>
          <canvas ref="canvas" :aria-label="`处理后的对称图，尺寸 ${outputWidth} 乘 ${sourceHeight} 像素`" role="img"></canvas>
        </figure>
      </div>
    </template>

    <div v-else class="empty">
      <div class="empty-copy">
        <p class="eyebrow">预览区</p>
        <p class="empty-title">等待照片</p>
        <p class="empty-detail">选取或粘贴后，自动标出照片中的人脸与对称轴。</p>
      </div>
      <div class="empty-graphic" aria-hidden="true"><span></span><i></i><span></span></div>
    </div>
  </section>
</template>

<style scoped>
.smart-mirror { width: 100%; }
.toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--s-3) var(--s-4);
  padding: var(--s-4);
  border: 1px solid var(--hairline);
  background: var(--bg-raise);
}
.toolbar-title { margin-top: var(--s-1); font-size: var(--step-1); line-height: 1.3; }
.toolbar-actions { display: flex; align-items: center; flex-wrap: wrap; gap: var(--s-2); }
.file-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  min-height: 40px;
  padding: 0 20px;
  border: 1px solid var(--line);
  background: var(--bg);
  cursor: pointer;
}
.file-button:hover { border-color: var(--text); }
.file-button:focus-within { outline: 2px solid var(--text); outline-offset: 3px; }
.file-button input { position: absolute; inset: 0; width: 100%; opacity: 0; cursor: pointer; }
.privacy {
  grid-column: 1 / -1;
  padding-top: var(--s-3);
  border-top: 1px solid var(--hairline);
  color: var(--text-mute);
  font-size: var(--step--1);
}
.status, .dimensions { color: var(--text-mute); font-size: var(--step--1); }
.controls {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr) auto;
  margin-top: var(--s-5);
  border-bottom: 1px solid var(--hairline);
}
.face-picker { grid-column: 1 / -1; min-width: 0; padding-bottom: var(--s-4); margin-bottom: var(--s-4); border-bottom: 1px solid var(--hairline); }
.face-picker > .eyebrow { margin-bottom: var(--s-3); }
.face-buttons { display: flex; flex-wrap: wrap; gap: var(--s-2); }
.control { min-width: 0; padding: 0 var(--s-4) var(--s-4); border-left: 1px solid var(--hairline); }
.face-picker + .control { padding-left: 0; border-left: 0; }
.face-buttons button, .direction-buttons button {
  min-height: 40px;
  padding: 0 var(--s-3);
  background: transparent;
  border: 1px solid var(--line);
  color: var(--text);
  font: inherit;
  cursor: pointer;
}
.face-buttons button:hover, .direction-buttons button:hover { background: var(--bg-raise); }
.face-buttons button[aria-pressed="true"], .direction-buttons button[aria-pressed="true"] { background: var(--text); color: var(--bg); border-color: var(--text); }
fieldset { min-width: 0; margin: 0; padding: 0; border: 0; }
legend { margin-bottom: var(--s-2); }
.direction-buttons { display: inline-flex; }
.direction-buttons button + button { border-left: 0; }
.axis-control { min-width: 0; }
.axis-control label { display: flex; justify-content: space-between; gap: var(--s-2); }
.axis-control input[type="range"] { display: block; width: 100%; margin: var(--s-3) 0 var(--s-1); accent-color: var(--text); }
.range-ends { display: flex; justify-content: space-between; color: var(--text-mute); font-size: var(--step--1); }
.export-control { display: flex; flex-direction: column; align-items: flex-start; justify-content: space-between; gap: var(--s-3); }
.previews { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--s-3); margin-top: var(--s-5); }
figure { display: flex; flex-direction: column; min-width: 0; min-height: 320px; border: 1px solid var(--hairline); background: var(--bg-raise); }
figcaption { width: 100%; padding: var(--s-3) var(--s-4); border-bottom: 1px solid var(--hairline); }
.image-frame { position: relative; display: inline-block; margin: auto; line-height: 0; }
.image-frame img { display: block; width: 100%; height: auto; }
.face-box { position: absolute; z-index: 1; margin: 0; padding: 0; background: transparent; border: 1px solid var(--text-mute); cursor: pointer; }
.face-box.selected, .face-box:hover { border: 2px solid var(--text); }
.face-midline { position: absolute; top: 0; bottom: 0; width: 1px; background: var(--text-mute); pointer-events: none; }
.face-box.selected .face-midline { background: var(--text); }
.face-number { position: absolute; top: 0; left: 0; padding: 2px 5px; background: var(--text); color: var(--bg); font-size: var(--step--1); line-height: 1; }
.axis-line { position: absolute; top: 0; bottom: 0; width: 1px; background: var(--text); box-shadow: 0 0 0 1px var(--bg); pointer-events: none; }
canvas { display: block; max-width: calc(100% - 2 * var(--s-4)); max-height: 70vh; width: auto; height: auto; margin: auto; }
.empty {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  min-height: 300px;
  margin-top: var(--s-5);
  border: 1px solid var(--hairline);
  background: var(--bg-raise);
}
.empty-copy { display: flex; flex-direction: column; justify-content: center; padding: var(--s-5); }
.empty-title { margin-top: var(--s-3); font-size: var(--step-2); line-height: var(--leading-tight); }
.empty-detail { margin-top: var(--s-3); max-width: var(--measure-cjk); color: var(--text-mute); }
.empty-graphic { display: flex; align-items: stretch; justify-content: center; gap: var(--s-3); padding: var(--s-6) var(--s-5); border-left: 1px solid var(--hairline); }
.empty-graphic span { width: 24%; border: 1px solid var(--line); }
.empty-graphic i { width: 1px; background: var(--text); }
.error { margin-top: var(--s-4); color: var(--text); }
@media (max-width: 899px) {
  .controls { grid-template-columns: 1fr; }
  .face-picker { margin-bottom: 0; }
  .control { padding: var(--s-4) 0; border-left: 0; border-top: 1px solid var(--hairline); }
  .face-picker + .control { padding-top: var(--s-4); border-top: 0; }
  .export-control { flex-direction: row; align-items: center; flex-wrap: wrap; }
  .previews { grid-template-columns: 1fr; }
}
@media (max-width: 599px) {
  .toolbar { grid-template-columns: 1fr; padding: var(--s-3); }
  .toolbar-title { font-size: 1.25rem; }
  .empty { grid-template-columns: 1fr; }
  .empty-copy { padding: var(--s-4); }
  .empty-title { font-size: 2rem; }
  .empty-graphic { min-height: 140px; padding: var(--s-4); border-left: 0; border-top: 1px solid var(--hairline); }
  figcaption { padding: var(--s-3); }
  canvas { max-width: calc(100% - 2 * var(--s-3)); }
}
</style>
