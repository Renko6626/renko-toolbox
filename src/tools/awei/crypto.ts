/**
 * 伪图书馆的加密格式。构建脚本（Node）和浏览器共用这一份实现，都走 WebCrypto。
 *
 * 密文布局：'AWE1'(4) | salt(16) | iv(12) | AES-256-GCM 密文（含 16 字节认证标签）
 *
 * 密钥写在本机 .env 的 AWEI_KEY 里，区分大小写。密钥可能是人起的（不一定是高熵随机数），
 * 所以用 PBKDF2 拉伸，让离线暴力猜测每次都要付出代价。迭代次数在速度和强度之间取折中：
 * 实测（Chromium，服务器 CPU）PBKDF2-SHA256 10 万次 ~30ms、60 万次 ~175ms，手机慢 3~5 倍；
 * AES-GCM 解密 1MB 只要 ~3ms。解锁时只派生一次。
 * 密钥不对时 GCM 校验失败，直接报错而不是吐乱码。
 */

// TS 5.9 起 Uint8Array 带了 buffer 泛型，WebCrypto 的 BufferSource 参数要显式收窄
const bs = (u: Uint8Array) => u as Uint8Array<ArrayBuffer>

const MAGIC = new TextEncoder().encode('AWE1')
const ITERATIONS = 100_000

export class WrongKeyError extends Error {
  constructor() {
    super('密钥不对')
  }
}

/**
 * 密钥可以是任意文本（中文、空格、标点都行），区分大小写。
 * 只做两件事：去掉首尾空白（复制粘贴时常带上）；NFC 归一化，
 * 免得同一个字在不同输入法下编码不同（组合字符 vs 预组合字符），看着一样却解不开。
 */
export function normalizeKey(input: string): string {
  return input.normalize('NFC').trim()
}

/** 16 字节随机数 → base32 小写，每 4 位一组：xxxx-xxxx-…（26 个字符） */
export function generateKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  const alphabet = 'abcdefghijklmnopqrstuvwxyz234567'
  let bits = 0
  let acc = 0
  let s = ''
  for (const b of bytes) {
    acc = (acc << 8) | b
    bits += 8
    while (bits >= 5) {
      s += alphabet[(acc >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits) s += alphabet[(acc << (5 - bits)) & 31]
  return s.match(/.{1,4}/g)!.join('-')
}

async function derive(secret: string, salt: Uint8Array, usage: KeyUsage): Promise<CryptoKey> {
  const pass = await crypto.subtle.importKey('raw', new TextEncoder().encode(normalizeKey(secret)), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: bs(salt), iterations: ITERATIONS },
    pass,
    { name: 'AES-GCM', length: 256 },
    false,
    [usage],
  )
}

export async function seal(secret: string, plain: Uint8Array): Promise<Uint8Array> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await derive(secret, salt, 'encrypt')
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bs(plain)))
  const out = new Uint8Array(4 + 16 + 12 + ct.length)
  out.set(MAGIC, 0)
  out.set(salt, 4)
  out.set(iv, 20)
  out.set(ct, 32)
  return out
}

export async function open(secret: string, blob: Uint8Array): Promise<Uint8Array> {
  if (blob.length < 48 || MAGIC.some((b, i) => blob[i] !== b)) throw new Error('密文文件格式不对')
  const key = await derive(secret, blob.subarray(4, 20), 'decrypt')
  try {
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bs(blob.subarray(20, 32)) }, key, bs(blob.subarray(32))))
  } catch {
    throw new WrongKeyError()
  }
}
