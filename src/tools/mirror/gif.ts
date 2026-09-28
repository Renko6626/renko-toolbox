import { parseGIF, decompressFrames, type ParsedGif, type ParsedFrame } from 'gifuct-js'
import { GIFEncoder, quantize, applyPalette } from 'gifenc'
import { mirrorSegments } from './geometry'

export interface GifAnimation {
  parsed: ParsedGif
  frames: ParsedFrame[]
  width: number
  height: number
  repeat: number
}

export async function readGif(file: File): Promise<GifAnimation | null> {
  const signature = await file.slice(0, 6).text()
  if (signature !== 'GIF87a' && signature !== 'GIF89a') return null
  if (file.size > 5 * 1024 * 1024) throw new Error('GIF 请控制在 5 MB 以内')
  const parsed = parseGIF(await file.arrayBuffer())
  const frames = decompressFrames(parsed, true)
  const { width, height } = parsed.lsd
  if (!width || !height || !frames.length) throw new Error('GIF 没有可用的画面')
  if (width > 1024 || height > 1024 || frames.length > 200 || width * height * frames.length > 20_000_000) {
    throw new Error('GIF 过大：最多 1024 × 1024、200 帧，且总像素不超过 2000 万；请缩小或缩短动画')
  }
  for (const frame of frames) {
    const d = frame.dims
    if (!d.width || !d.height || d.left + d.width > width || d.top + d.height > height) {
      throw new Error('GIF 帧尺寸无效')
    }
  }
  let repeat = -1
  for (const frame of parsed.frames) {
    if ('application' in frame && /^(NETSCAPE2.0|ANIMEXTS1.0)$/.test(frame.application.id)) {
      const blocks = frame.application.blocks
      if (blocks[0] === 1 && blocks.length >= 3) repeat = blocks[1] | (blocks[2] << 8)
    }
  }
  return { parsed, frames, width, height, repeat }
}

// GIF frames may be partial patches. Compose them before mirroring, respecting disposal.
function compositor(animation: GifAnimation) {
  const { width, height, parsed } = animation
  let pixels = new Uint8ClampedArray(width * height * 4)
  let previous: ParsedFrame | null = null
  let restored: Uint8ClampedArray | null = null
  function background(left: number, top: number, w: number, h: number) {
    const color = parsed.gct?.[parsed.lsd.backgroundColorIndex]
    for (let y = top; y < top + h; y++) for (let x = left; x < left + w; x++) {
      pixels.set(color ? [...color, 255] : [0, 0, 0, 0], (y * width + x) * 4)
    }
  }
  return (frame: ParsedFrame) => {
    if (!previous) background(0, 0, width, height)
    if (previous?.disposalType === 2) {
      const d = previous.dims
      background(d.left, d.top, d.width, d.height)
    } else if (previous?.disposalType === 3 && restored) pixels.set(restored)
    restored = frame.disposalType === 3 ? pixels.slice() : null
    const d = frame.dims
    for (let y = 0; y < d.height; y++) for (let x = 0; x < d.width; x++) {
      const from = (y * d.width + x) * 4
      if (frame.patch[from + 3]) pixels.set(frame.patch.subarray(from, from + 4), ((y + d.top) * width + x + d.left) * 4)
    }
    previous = frame
    return { pixels, delay: Math.max(0, frame.delay * 10) }
  }
}

export async function gifPreview(animation: GifAnimation): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = animation.width
  canvas.height = animation.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('无法创建 GIF 预览')
  const image = context.createImageData(canvas.width, canvas.height)
  image.data.set(compositor(animation)(animation.frames[0]).pixels)
  context.putImageData(image, 0, 0)
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('无法创建 GIF 预览')), 'image/png'))
}

export async function mirrorGif(animation: GifAnimation, axis: number, direction: 'left' | 'right', progress: (percent: number) => void, active: () => boolean): Promise<Blob> {
  const plan = mirrorSegments(animation.width, axis, direction)
  const compose = compositor(animation)
  const encoder = GIFEncoder()
  for (let i = 0; i < animation.frames.length; i++) {
    // Yield between frames so progress can paint and navigation can cancel work.
    await new Promise(resolve => setTimeout(resolve, 0))
    if (!active()) throw new Error('已取消 GIF 导出')
    const { pixels, delay } = compose(animation.frames[i])
    const output = new Uint8ClampedArray(plan.outputWidth * animation.height * 4)
    for (let y = 0; y < animation.height; y++) for (const segment of plan.segments) {
      for (let x = 0; x < segment.width; x++) {
        const sx = segment.sourceX + (segment.flip ? segment.width - 1 - x : x)
        const from = (y * animation.width + sx) * 4
        output.set(pixels.subarray(from, from + 4), (y * plan.outputWidth + segment.targetX + x) * 4)
      }
    }
    const palette = quantize(output, 256, { format: 'rgba4444', oneBitAlpha: true })
    const transparentIndex = palette.findIndex(color => color[3] === 0)
    encoder.writeFrame(applyPalette(output, palette, 'rgba4444'), plan.outputWidth, animation.height, {
      palette, delay, repeat: animation.repeat, dispose: 2,
      transparent: transparentIndex >= 0, transparentIndex: Math.max(0, transparentIndex),
    })
    progress(Math.round((i + 1) / animation.frames.length * 100))
  }
  encoder.finish()
  return new Blob([encoder.bytes()], { type: 'image/gif' })
}
