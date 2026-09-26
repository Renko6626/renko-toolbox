import { computed, shallowRef } from 'vue'
import dataUrl from './data.enc?url'
import vectorsUrl from './semantic/vectors.enc?url'
import { open, WrongKeyError } from './crypto'
import { parseQuotes, type Quote } from './parse'

export { WrongKeyError }

const STORE = 'awei:key'

/** 解密后的语录；null = 还锁着。只存在内存里。 */
export const quotes = shallowRef<Quote[] | null>(null)
let secret: string | null = null

async function fetchBytes(url: string): Promise<Uint8Array> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`加载失败（HTTP ${r.status}）`)
  return new Uint8Array(await r.arrayBuffer())
}

export async function unlock(key: string, remember: boolean) {
  const plain = await open(key, await fetchBytes(dataUrl))
  secret = key
  quotes.value = parseQuotes(new TextDecoder().decode(plain))
  try {
    if (remember) localStorage.setItem(STORE, key)
    else localStorage.removeItem(STORE)
  } catch {}
}

/** 这台设备上记住过密钥就直接解锁；密钥已失效（比如换过密钥）就忘掉它 */
export async function tryRemembered(): Promise<boolean> {
  let key: string | null = null
  try {
    key = localStorage.getItem(STORE)
  } catch {}
  if (!key) return false
  try {
    await unlock(key, true)
    return true
  } catch (e) {
    if (e instanceof WrongKeyError) {
      try {
        localStorage.removeItem(STORE)
      } catch {}
    }
    return false
  }
}

export function lock() {
  quotes.value = null
  secret = null
  try {
    localStorage.removeItem(STORE)
  } catch {}
}

/** 语义向量：count × dim 的 int8（已归一化 ×127） */
export async function loadVectors(): Promise<{ count: number; dim: number; data: Int8Array }> {
  if (!secret) throw new Error('还没解锁')
  const plain = await open(secret, await fetchBytes(vectorsUrl))
  const view = new DataView(plain.buffer, plain.byteOffset)
  const count = view.getUint32(0, true)
  const dim = view.getUint32(4, true)
  return { count, dim, data: new Int8Array(plain.buffer, plain.byteOffset + 8, count * dim) }
}

export interface Month {
  key: string
  count: number
  from: number
  to: number
}

/** 每个自然月的消息数与日期范围（当天 00:00 时间戳），按时间升序 */
export const months = computed<Month[]>(() => {
  const map = new Map<string, Month>()
  for (const q of quotes.value ?? []) {
    const key = q.time.slice(0, 7)
    let m = map.get(key)
    if (!m) {
      const [y, mo] = key.split('-').map(Number)
      m = { key, count: 0, from: new Date(y, mo - 1, 1).getTime(), to: new Date(y, mo, 0).getTime() }
      map.set(key, m)
    }
    m.count++
  }
  return [...map.values()]
})
