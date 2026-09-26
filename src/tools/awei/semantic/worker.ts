/// <reference lib="webworker" />
// 模型跑在 worker 里，推理时页面不卡。所有文件都从本站加载（见 scripts/prepare-semantic.ts）。
import { env, pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers'
import { DTYPE, MODEL, POOLING } from './model'

export type In = { type: 'load' } | { type: 'embed'; id: number; text: string }
export type Out =
  | { type: 'progress'; file: string; loaded: number; total: number }
  | { type: 'ready' }
  | { type: 'error'; message: string }
  | { type: 'vec'; id: number; vec: Float32Array }

const post = (m: Out) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(m)
const base = new URL(import.meta.env.BASE_URL, self.location.origin).href

env.allowRemoteModels = false
env.allowLocalModels = true
// 必须是站内相对路径（/renko-toolbox/models/），不能是完整 URL：transformers.js 4.3 的
// get_file_metadata 遇到完整 URL 会跳过本地检查，于是判定 tokenizer_config.json 不存在，
// 不加载 tokenizer，推理时报「this.tokenizer is not a function」。
env.localModelPath = import.meta.env.BASE_URL + 'models/'

/** 自己拉 wasm，这样它也能进进度条；ORT 自己去拉的话我们看不到进度 */
async function fetchWithProgress(url: string, file: string): Promise<ArrayBuffer> {
  const res = await fetch(url)
  if (!res.ok || !res.body) throw new Error(`${file} 加载失败（HTTP ${res.status}）`)
  const total = Number(res.headers.get('content-length')) || 0
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let loaded = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    loaded += value.length
    post({ type: 'progress', file, loaded, total: Math.max(total, loaded) })
  }
  post({ type: 'progress', file, loaded, total: loaded })
  const buf = new Uint8Array(loaded)
  let off = 0
  for (const c of chunks) {
    buf.set(c, off)
    off += c.length
  }
  return buf.buffer
}

let extractor: FeatureExtractionPipeline | null = null

async function load() {
  const wasm = (env.backends.onnx as { wasm: Record<string, unknown> }).wasm
  wasm.wasmPaths = { mjs: base + 'ort/ort-wasm-simd-threaded.mjs' }
  wasm.wasmBinary = await fetchWithProgress(base + 'ort/ort-wasm-simd-threaded.wasm', 'runtime')
  extractor = (await pipeline('feature-extraction', MODEL, {
    dtype: DTYPE,
    device: 'wasm',
    progress_callback: (p: { status: string; file?: string; loaded?: number; total?: number }) => {
      if (p.status === 'progress' && p.file) post({ type: 'progress', file: p.file, loaded: p.loaded ?? 0, total: p.total ?? 0 })
    },
  })) as FeatureExtractionPipeline
  post({ type: 'ready' })
}

self.onmessage = async (e: MessageEvent<In>) => {
  const m = e.data
  try {
    if (m.type === 'load') await load()
    else if (m.type === 'embed') {
      if (!extractor) throw new Error('模型还没加载好')
      const t = await extractor(m.text, { pooling: POOLING, normalize: true })
      post({ type: 'vec', id: m.id, vec: t.data as Float32Array })
    }
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}
