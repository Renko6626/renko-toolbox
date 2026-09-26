/**
 * 本机运行：pnpm encrypt
 *   读 private/awei.txt（明文，不入库）和 .env 里的 AWEI_KEY，
 *   写出 src/tools/awei/data.enc（语录）和 src/tools/awei/semantic/vectors.enc（语义向量），这两个入库。
 * .env 里还没有 AWEI_KEY 时会生成一个随机密钥写进去。换密钥 = 改掉那一行再跑一次。
 * 密钥可以是任意文本，`=` 后面的内容原样使用（不要加引号，# 也不算注释），首尾空白会去掉。
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { generateKey, seal } from '../src/tools/awei/crypto.ts'
import { parseQuotes } from '../src/tools/awei/parse.ts'
import { DTYPE, MODEL, POOLING } from '../src/tools/awei/semantic/model.ts'
import { ensureModelAssets, pub, root } from './model-assets.ts'

const envPath = join(root, '.env')
const envText = existsSync(envPath) ? readFileSync(envPath, 'utf8') : ''
let key = /^AWEI_KEY=(.+)$/m.exec(envText)?.[1].trim()
if (!key) {
  key = generateKey()
  appendFileSync(envPath, `${envText && !envText.endsWith('\n') ? '\n' : ''}AWEI_KEY=${key}\n`)
  console.log('[encrypt] .env 里没有 AWEI_KEY，已生成一个新的并写入 .env')
}

const raw = readFileSync(join(root, 'private/awei.txt'))
const quotes = parseQuotes(raw.toString('utf8'))
writeFileSync(join(root, 'src/tools/awei/data.enc'), await seal(key, raw))
console.log(`[encrypt] data.enc：${quotes.length} 条语录`)

// 语义向量：header = count(u32 LE) | dim(u32 LE)，后面是 int8（已归一化 ×127）
ensureModelAssets()
const { pipeline, env } = await import('@huggingface/transformers')
env.allowRemoteModels = false
env.localModelPath = join(pub, 'models') + '/'
const extract = await pipeline('feature-extraction', MODEL, { dtype: DTYPE })
let dim = 0
let vec: Int8Array | null = null
const B = 32
for (let s = 0; s < quotes.length; s += B) {
  const t = await extract(quotes.slice(s, s + B).map((q) => q.text), { pooling: POOLING, normalize: true })
  dim = t.dims[1]
  vec ??= new Int8Array(quotes.length * dim)
  const data = t.data as Float32Array
  for (let k = 0; k < data.length; k++) vec[s * dim + k] = Math.round(data[k] * 127)
}
const payload = new Uint8Array(8 + vec!.length)
new DataView(payload.buffer).setUint32(0, quotes.length, true)
new DataView(payload.buffer).setUint32(4, dim, true)
payload.set(new Uint8Array(vec!.buffer), 8)
writeFileSync(join(root, 'src/tools/awei/semantic/vectors.enc'), await seal(key, payload))
console.log(`[encrypt] vectors.enc：${quotes.length}×${dim}`)
