/**
 * 语义搜索要的静态文件，放到 public/ 下（不入库）：
 *   public/models/<MODEL>/…   模型（浏览器从本站加载，不依赖 HF，国内也能用）
 *   public/ort/…              onnxruntime-web 的纯 CPU 版 wasm
 * 下载走 curl（自动吃 https_proxy）；国内网络可设 HF_ENDPOINT=https://hf-mirror.com。
 */
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MODEL, MODEL_FILES } from '../src/tools/awei/semantic/model.ts'

export const root = join(dirname(fileURLToPath(import.meta.url)), '..')
export const pub = join(root, 'public')

export function ensureModelAssets() {
  const HF = (process.env.HF_ENDPOINT ?? 'https://huggingface.co').replace(/\/$/, '')
  for (const f of MODEL_FILES) {
    const dst = join(pub, 'models', MODEL, f)
    if (existsSync(dst) && statSync(dst).size > 0) continue
    mkdirSync(dirname(dst), { recursive: true })
    console.log(`[semantic] 下载 ${MODEL}/${f}`)
    execFileSync('curl', ['-fL', '--retry', '3', '-o', dst, `${HF}/${MODEL}/resolve/main/${f}`], { stdio: 'inherit' })
  }

  // 只要纯 CPU 版（14MB）。transformers 默认挑 asyncify 版（27MB，为 WebGPU 准备），这里用不上；
  // worker 里把 wasmPaths 指到这两个文件。两个包都没导出 package.json，只能顺着主入口找。
  const tfEntry = createRequire(import.meta.url).resolve('@huggingface/transformers')
  const ortDist = dirname(createRequire(tfEntry).resolve('onnxruntime-web'))
  mkdirSync(join(pub, 'ort'), { recursive: true })
  for (const f of readdirSync(ortDist)) {
    if (/^ort-wasm-simd-threaded\.(wasm|mjs)$/.test(f)) copyFileSync(join(ortDist, f), join(pub, 'ort', f))
  }
}
