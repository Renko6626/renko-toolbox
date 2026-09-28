<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef, watch } from 'vue'
import { NButton, useMessage } from 'naive-ui'
import { mirrorSegments } from './geometry'
import { useImageImport } from './useImageImport'

type Direction = 'left' | 'right'

const message = useMessage()
const source = shallowRef<HTMLImageElement | null>(null)
const sourceUrl = ref('')
const filename = ref('')
const axis = ref(0.5)
const direction = ref<Direction>('left')
const canvas = ref<HTMLCanvasElement | null>(null)
const renderError = ref('')

const sourceWidth = computed(() => source.value?.naturalWidth ?? 0)
const sourceHeight = computed(() => source.value?.naturalHeight ?? 0)
const outputWidth = computed(() => source.value
  ? mirrorSegments(sourceWidth.value, axis.value, direction.value).outputWidth
  : 0)
const axisPercent = computed(() => `${axis.value / sourceWidth.value * 100}%`)
const sourceFrameWidth = computed(() => `min(100%, ${sourceWidth.value}px, ${70 * sourceWidth.value / sourceHeight.value}vh)`)

let loadVersion = 0
let frame = 0

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

    const oldUrl = sourceUrl.value
    axis.value = image.naturalWidth / 2
    filename.value = file.name
    sourceUrl.value = url
    source.value = image
    renderError.value = ''
    if (oldUrl) URL.revokeObjectURL(oldUrl)
  } catch {
    URL.revokeObjectURL(url)
    if (version === loadVersion) message.error('无法打开这张图片，请换一张试试')
  }
}

const { chooseFile, pasteFromClipboard } = useImageImport(loadFile, (text) => message.warning(text))

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
  if (frame) {
    cancelAnimationFrame(frame)
    render()
  }
  if (renderError.value || !canvas.value) return

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
      link.download = `${name}-mirror-${selectedDirection}.png`
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
})
</script>

<template>
  <section class="mirror-tool">
    <div class="toolbar">
      <label class="file-button">
        选择图片 / 相册
        <input type="file" accept="image/*" aria-label="选择图片或从相册选取" @change="chooseFile" />
      </label>
      <NButton @click="pasteFromClipboard">粘贴图片</NButton>
      <span class="privacy">也可按 Ctrl/⌘+V 粘贴；图片只在浏览器里处理。</span>
    </div>

    <template v-if="source">
      <div class="controls">
        <fieldset>
          <legend class="eyebrow">保留哪一侧</legend>
          <div class="direction-buttons">
            <button type="button" :aria-pressed="direction === 'left'" @click="direction = 'left'">
              左 → 右
            </button>
            <button type="button" :aria-pressed="direction === 'right'" @click="direction = 'right'">
              右 → 左
            </button>
          </div>
        </fieldset>

        <div class="axis-control">
          <label for="mirror-axis" class="eyebrow">对称轴 <span class="mono">{{ axis }} px</span></label>
          <input
            id="mirror-axis"
            v-model.number="axis"
            type="range"
            :min="0.5"
            :max="sourceWidth - 0.5"
            step="0.5"
            :disabled="sourceWidth === 1"
          />
          <div class="range-ends mono"><span>左侧</span><span>右侧</span></div>
        </div>

        <div class="export-control">
          <p class="dimensions mono">{{ sourceWidth }} × {{ sourceHeight }} → {{ outputWidth }} × {{ sourceHeight }}</p>
          <NButton type="primary" :disabled="!!renderError" @click="download">下载 PNG</NButton>
        </div>
      </div>

      <p v-if="renderError" class="error" role="alert">{{ renderError }}</p>

      <div class="previews">
        <figure>
          <figcaption class="eyebrow">原图 / 对称轴</figcaption>
          <div class="image-frame" :style="{ width: sourceFrameWidth }">
            <img :src="sourceUrl" :alt="filename" />
            <span class="axis-line" :style="{ left: axisPercent }" aria-hidden="true"></span>
          </div>
        </figure>
        <figure>
          <figcaption class="eyebrow">处理结果</figcaption>
          <canvas ref="canvas" :aria-label="`处理后的对称图，尺寸 ${outputWidth} 乘 ${sourceHeight} 像素`" role="img"></canvas>
        </figure>
      </div>
    </template>

    <p v-else class="empty">选择一张图片，预览会显示在这里。</p>
  </section>
</template>

<style scoped>
.mirror-tool { max-width: 1440px; }
.toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: var(--s-3); }
.file-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  min-height: 40px;
  padding: 0 20px;
  border: 1px solid var(--line);
  cursor: pointer;
}
.file-button:hover { border-color: var(--text); background: var(--bg-raise); }
.file-button:focus-within { outline: 2px solid var(--text); outline-offset: 3px; }
.file-button input { position: absolute; inset: 0; width: 100%; opacity: 0; cursor: pointer; }
.privacy { color: var(--text-mute); font-size: var(--step--1); }
.controls {
  display: grid;
  gap: var(--s-4);
  margin-top: var(--s-5);
  padding-bottom: var(--s-5);
  border-bottom: 1px solid var(--hairline);
}
fieldset { min-width: 0; margin: 0; padding: 0; border: 0; }
legend { margin-bottom: var(--s-2); }
.direction-buttons { display: inline-flex; }
.direction-buttons button {
  min-height: 40px;
  padding: 0 var(--s-3);
  background: transparent;
  border: 1px solid var(--line);
  color: var(--text);
  font: inherit;
  cursor: pointer;
}
.direction-buttons button + button { border-left: 0; }
.direction-buttons button:hover { background: var(--bg-raise); }
.direction-buttons button[aria-pressed="true"] { background: var(--text); color: var(--bg); border-color: var(--text); }
.direction-buttons button[aria-pressed="true"] + button { border-left: 0; }
.axis-control { min-width: 0; }
.axis-control label { display: flex; justify-content: space-between; gap: var(--s-2); }
.axis-control input[type="range"] { display: block; width: 100%; margin: var(--s-3) 0 var(--s-1); accent-color: var(--text); }
.range-ends { display: flex; justify-content: space-between; color: var(--text-mute); font-size: var(--step--1); }
.export-control { display: flex; flex-wrap: wrap; align-items: end; gap: var(--s-3); }
.dimensions { color: var(--text-mute); font-size: var(--step--1); }
.previews { display: grid; gap: var(--s-5); margin-top: var(--s-5); }
figure { min-width: 0; }
figcaption { margin-bottom: var(--s-3); }
.image-frame { position: relative; display: inline-block; line-height: 0; }
.image-frame img { display: block; width: 100%; height: auto; }
canvas { display: block; max-width: 100%; max-height: 70vh; width: auto; height: auto; }
.axis-line { position: absolute; top: 0; bottom: 0; width: 1px; background: var(--text); box-shadow: 0 0 0 1px var(--bg); pointer-events: none; }
.empty { margin-top: var(--s-6); color: var(--text-mute); }
.error { margin-top: var(--s-4); color: var(--text); }
@media (min-width: 900px) {
  .controls { grid-template-columns: auto minmax(280px, 1fr) auto; align-items: end; }
  .previews { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
