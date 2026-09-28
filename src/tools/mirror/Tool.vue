<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef, watch } from 'vue'
import { NButton, useMessage } from 'naive-ui'
import { mirrorSegments } from './geometry'
import { useImageImport } from './useImageImport'
import { gifPreview, mirrorGif, readGif, type GifAnimation } from './gif'

type Direction = 'left' | 'right'

const message = useMessage()
const source = shallowRef<HTMLImageElement | null>(null)
const sourceUrl = ref('')
const filename = ref('')
const axis = ref(0.5)
const direction = ref<Direction>('left')
const canvas = ref<HTMLCanvasElement | null>(null)
const renderError = ref('')
const gif = shallowRef<GifAnimation | null>(null)
const gifBusy = ref(false)
const gifProgress = ref(0)
const gifResultUrl = ref('')
const gifResult = shallowRef<Blob | null>(null)
let gifJob = 0

const sourceWidth = computed(() => source.value?.naturalWidth ?? 0)
const sourceHeight = computed(() => source.value?.naturalHeight ?? 0)
const outputWidth = computed(() => source.value
  ? mirrorSegments(sourceWidth.value, axis.value, direction.value).outputWidth
  : 0)
const axisPercent = computed(() => `${axis.value / sourceWidth.value * 100}%`)
const sourceFrameWidth = computed(() => `min(100%, ${sourceWidth.value}px, ${70 * sourceWidth.value / sourceHeight.value}vh)`)

let loadVersion = 0
let frame = 0

function invalidateGifResult() {
  gifJob++
  gifResult.value = null
  if (gifResultUrl.value) URL.revokeObjectURL(gifResultUrl.value)
  gifResultUrl.value = ''
}

async function loadFile(file: File) {
  const version = ++loadVersion
  const url = URL.createObjectURL(file)
  let animation: GifAnimation | null = null
  try { animation = await readGif(file) } catch (error) {
    if (file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif')) {
      URL.revokeObjectURL(url)
      if (version === loadVersion) message.error(error instanceof Error ? error.message : '无法打开 GIF')
      return
    }
  }
  const image = new Image()
  if (animation) {
    try {
      const preview = await gifPreview(animation)
      image.src = URL.createObjectURL(preview)
    } catch { URL.revokeObjectURL(url); message.error('无法生成 GIF 预览'); return }
  } else image.src = url

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
    gif.value = animation
    invalidateGifResult()
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

watch([source, axis, direction], () => {
  scheduleRender()
  if (gif.value) invalidateGifResult()
}, { flush: 'post' })

async function generateGif() {
  if (!gif.value || gifBusy.value) return gifResult.value
  const job = ++gifJob
  gifBusy.value = true
  gifProgress.value = 0
  try {
    const blob = await mirrorGif(gif.value, axis.value, direction.value,
      value => { if (job === gifJob) gifProgress.value = value }, () => job === gifJob)
    if (job !== gifJob) return null
    gifResult.value = blob
    gifResultUrl.value = URL.createObjectURL(blob)
    return blob
  } catch (error) {
    if (job === gifJob && error instanceof Error && error.message !== '已取消 GIF 导出') message.error(error.message)
    return null
  } finally {
    if (job === gifJob) gifBusy.value = false
  }
}

async function copyGif() {
  const blob = await generateGif()
  if (!blob) return
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
    message.warning('当前浏览器不支持复制 GIF，请使用下载按钮。')
    return
  }
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/gif': blob })])
    message.success('GIF 已复制到剪贴板')
  } catch { message.error('复制 GIF 失败，请检查剪贴板权限。') }
}

async function download() {
  if (!gif.value) {
    if (frame) {
      cancelAnimationFrame(frame)
      render()
    }
    if (renderError.value || !canvas.value) return
  }

  const name = filename.value.replace(/\.[^.]+$/, '') || 'image'
  const selectedDirection = direction.value
  if (gif.value) {
    const blob = await generateGif()
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a'); link.href = url; link.download = `${name}-mirror-${selectedDirection}.gif`; link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    return
  }
  try {
    canvas.value!.toBlob((blob) => {
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
  if (gifResultUrl.value) URL.revokeObjectURL(gifResultUrl.value)
})
</script>

<template>
  <section class="mirror-tool">
    <div class="toolbar">
      <div class="toolbar-copy">
        <p class="eyebrow">图片来源</p>
        <p class="toolbar-title">选择或粘贴一张图片</p>
      </div>
      <div class="toolbar-actions">
        <label class="file-button">
          选择图片 / 相册
          <input type="file" accept="image/*" aria-label="选择图片或从相册选取" @change="chooseFile" />
        </label>
        <NButton @click="pasteFromClipboard">粘贴图片</NButton>
      </div>
      <span class="privacy">也可按 Ctrl/⌘+V 粘贴；图片只在浏览器里处理。GIF 支持动画，文件请控制在 5 MB 以内。</span>
    </div>

    <template v-if="source">
      <div class="controls">
        <fieldset class="control">
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

        <div class="axis-control control">
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

        <div class="export-control control">
          <p class="dimensions mono">{{ sourceWidth }} × {{ sourceHeight }} → {{ outputWidth }} × {{ sourceHeight }}</p>
          <NButton type="primary" :disabled="!!renderError || gifBusy" @click="download">{{ gifBusy ? `正在生成 GIF ${gifProgress}%` : gif ? '下载 GIF' : '下载 PNG' }}</NButton>
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
          <img v-if="gifResultUrl" :src="gifResultUrl" :alt="`处理后的 GIF，尺寸 ${outputWidth} 乘 ${sourceHeight} 像素`" class="gif-result" />
          <canvas v-else ref="canvas" :aria-label="`处理后的对称图，尺寸 ${outputWidth} 乘 ${sourceHeight} 像素`" role="img"></canvas>
          <div v-if="gif" class="gif-actions">
            <NButton size="small" :loading="gifBusy" @click="generateGif">{{ gifResultUrl ? '重新生成 GIF' : '生成 GIF 预览' }}</NButton>
            <NButton size="small" :disabled="!gifResultUrl || gifBusy" @click="copyGif">复制 GIF</NButton>
          </div>
        </figure>
      </div>
    </template>

    <div v-else class="empty">
      <div class="empty-copy">
        <p class="eyebrow">预览区</p>
        <p class="empty-title">等待图片</p>
        <p class="empty-detail">选取或粘贴后，在这里查看原图与镜像结果。</p>
      </div>
      <div class="empty-graphic" aria-hidden="true"><span></span><i></i><span></span></div>
    </div>
  </section>
</template>

<style scoped>
.mirror-tool { width: 100%; }
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
.controls {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr) auto;
  margin-top: var(--s-5);
  border-bottom: 1px solid var(--hairline);
}
.control { min-width: 0; padding: 0 var(--s-4) var(--s-4); border-left: 1px solid var(--hairline); }
.control:first-child { padding-left: 0; border-left: 0; }
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
.export-control { display: flex; flex-direction: column; align-items: flex-start; justify-content: space-between; gap: var(--s-3); }
.dimensions { color: var(--text-mute); font-size: var(--step--1); }
.previews { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--s-3); margin-top: var(--s-5); }
figure { display: flex; flex-direction: column; min-width: 0; min-height: 320px; border: 1px solid var(--hairline); background: var(--bg-raise); }
figcaption { width: 100%; padding: var(--s-3) var(--s-4); border-bottom: 1px solid var(--hairline); }
.image-frame { position: relative; display: inline-block; margin: auto; line-height: 0; }
.image-frame img { display: block; width: 100%; height: auto; }
canvas { display: block; max-width: calc(100% - 2 * var(--s-4)); max-height: 70vh; width: auto; height: auto; margin: auto; }
.gif-result { display: block; max-width: calc(100% - 2 * var(--s-4)); max-height: 70vh; width: auto; height: auto; margin: auto; }
.gif-actions { display: flex; gap: var(--s-2); justify-content: center; padding: 0 var(--s-4) var(--s-4); }
.axis-line { position: absolute; top: 0; bottom: 0; width: 1px; background: var(--text); box-shadow: 0 0 0 1px var(--bg); pointer-events: none; }
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
  .control { padding: var(--s-4) 0; border-left: 0; border-top: 1px solid var(--hairline); }
  .control:first-child { padding-top: 0; border-top: 0; }
  .export-control { flex-direction: row; align-items: center; flex-wrap: wrap; }
  .previews { grid-template-columns: 1fr; }
}
@media (max-width: 599px) {
  .toolbar { grid-template-columns: 1fr; padding: var(--s-3); }
  .toolbar-actions { gap: var(--s-2); }
  .toolbar-title { font-size: 1.25rem; }
  .empty { grid-template-columns: 1fr; }
  .empty-copy { padding: var(--s-4); }
  .empty-title { font-size: 2rem; }
  .empty-graphic { min-height: 140px; padding: var(--s-4); border-left: 0; border-top: 1px solid var(--hairline); }
  figcaption { padding: var(--s-3); }
  canvas { max-width: calc(100% - 2 * var(--s-3)); }
}
</style>
