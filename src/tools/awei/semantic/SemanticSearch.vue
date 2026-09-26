<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import { NButton, NCheckbox, NInput, NProgress } from 'naive-ui'
import { loadVectors, quotes } from '../vault'
import type { Quote } from '../parse'
import QuoteRow from '../QuoteRow.vue'
import { useCopy, withTime } from '../copy'
import type { In, Out } from './worker'

// LockGate 保证渲染到这里时已经解锁
const all = quotes.value!
const TOP = 30
const CONSENT = 'awei-sem:consent'
// 示例必须是通用说法：页面代码是公开的，不能从这里透露聊天内容
const EXAMPLES = ['很生气', '好困', '考试没考好', '说不清楚', '好羡慕']

// 各部分体积（未压缩），只用来在下载前告诉用户大概多大；真实进度以下载时为准
const SIZE_MB = { model: 24, runtime: 14, vectors: 1 }
const TOTAL_MB = SIZE_MB.model + SIZE_MB.runtime + SIZE_MB.vectors

const router = useRouter()
const copy = useCopy()

type Phase = 'idle' | 'loading' | 'ready' | 'error'
const phase = ref<Phase>('idle')
const errorMsg = ref('')
const files = ref<Record<string, { loaded: number; total: number }>>({})
const loaded = computed(() => Object.values(files.value).reduce((s, f) => s + f.loaded, 0))
const total = computed(() => Math.max(Object.values(files.value).reduce((s, f) => s + f.total, 0), TOTAL_MB * 1e6))
const mb = (n: number) => (n / 1e6).toFixed(1)

const supported = typeof WebAssembly === 'object' && typeof Worker === 'function'

let worker: Worker | null = null
let vectors: Int8Array | null = null
let dim = 0
const pending = new Map<number, (v: Float32Array) => void>()
let seq = 0

function fail(msg: string) {
  phase.value = 'error'
  errorMsg.value = msg
}

async function start() {
  try {
    localStorage.setItem(CONSENT, '1')
  } catch {}
  phase.value = 'loading'
  files.value = {}
  worker?.terminate()
  worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
  const ready = new Promise<void>((resolve, reject) => {
    worker!.onmessage = (e: MessageEvent<Out>) => {
      const m = e.data
      if (m.type === 'progress') files.value = { ...files.value, [m.file]: { loaded: m.loaded, total: m.total } }
      else if (m.type === 'ready') resolve()
      else if (m.type === 'vec') {
        pending.get(m.id)?.(m.vec)
        pending.delete(m.id)
      } else if (m.type === 'error') {
        // 加载阶段的错误走 reject；加载完之后（推理时）的错误直接显示出来
        if (phase.value === 'ready') {
          busy.value = false
          fail(m.message)
        } else reject(new Error(m.message))
      }
    }
    worker!.onerror = (e) => reject(new Error(e.message || 'worker 启动失败'))
  })
  worker.postMessage({ type: 'load' } satisfies In)

  try {
    const v = await loadVectors()
    if (v.count !== all.length) throw new Error('向量和语录数量对不上，需要重新跑 pnpm encrypt')
    dim = v.dim
    vectors = v.data
    files.value = { ...files.value, vectors: { loaded: v.data.byteLength, total: v.data.byteLength } }
    await ready
    phase.value = 'ready'
    if (q.value.trim()) search()
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err))
  }
}

function embed(text: string): Promise<Float32Array> {
  const id = ++seq
  return new Promise((resolve) => {
    pending.set(id, resolve)
    worker!.postMessage({ type: 'embed', id, text } satisfies In)
  })
}

onMounted(() => {
  let ok = false
  try {
    ok = localStorage.getItem(CONSENT) === '1'
  } catch {}
  if (ok && supported) start()
})
onBeforeUnmount(() => worker?.terminate())

// ---- 搜索 ----
const q = ref('')
const hideShort = ref(true)
const busy = ref(false)
const scored = shallowRef<{ q: Quote; score: number }[] | null>(null)
const bare = all.map((x) => x.text.replace(/[\p{P}\p{S}\s]/gu, '').length)

let lastText = ''
async function search() {
  const text = q.value.trim()
  if (phase.value !== 'ready' || !vectors) return
  if (!text) {
    scored.value = null
    return
  }
  lastText = text
  busy.value = true
  const v = await embed(text)
  if (text !== lastText) return // 已经有更新的查询了
  const s = new Float32Array(all.length)
  for (let i = 0; i < all.length; i++) {
    let acc = 0
    const o = i * dim
    for (let k = 0; k < dim; k++) acc += v[k] * vectors[o + k]
    s[i] = acc / 127
  }
  scored.value = all.map((x, i) => ({ q: x, score: s[i] })).sort((a, b) => b.score - a.score)
  busy.value = false
}

let timer: ReturnType<typeof setTimeout> | undefined
watch(q, () => {
  clearTimeout(timer)
  timer = setTimeout(search, 400)
})

const results = computed(() => {
  if (!scored.value) return []
  return scored.value.filter((r) => !hideShort.value || bare[r.q.i] >= 3).slice(0, TOP)
})

function useExample(s: string) {
  q.value = s
  clearTimeout(timer)
  search()
}

function onlyDay(x: Quote) {
  router.push({ path: '/t/awei', query: { from: x.time.slice(0, 10), to: x.time.slice(0, 10) } })
}
</script>

<template>
  <p class="back"><RouterLink to="/t/awei">← 回到关键词搜索</RouterLink></p>

  <section v-if="phase !== 'ready'" class="gate">
    <p class="eyebrow">实验性功能</p>
    <div class="gate-body">
      <p>
        这一页用一个小型中文语义模型（bge-small-zh）按<em>意思</em>而不是按字面找语录。
        比如搜「很生气」，能找到发火的那些话，哪怕原话里一个「气」字都没有。
      </p>
      <p>
        模型在你的浏览器里运行，搜索内容不会发到任何服务器。第一次使用要下载最多约
        <strong class="mono">{{ TOTAL_MB }} MB</strong>（模型 {{ SIZE_MB.model }} MB、运行时 {{ SIZE_MB.runtime }} MB、语录向量 {{ SIZE_MB.vectors }} MB），
        之后浏览器会缓存。用流量的话建议连上 Wi-Fi 再开。
      </p>
      <p class="mute">「？」「算了」这类很短的消息没法按意思区分，默认不显示；要找原话还是关键词搜索更准。</p>
    </div>

    <p v-if="!supported" class="err">这个浏览器不支持 WebAssembly 或 Web Worker，用不了语义搜索。</p>

    <template v-else-if="phase === 'idle'">
      <NButton type="primary" class="go" @click="start">下载模型并开始</NButton>
    </template>

    <div v-else-if="phase === 'loading'" class="loading" role="status" aria-live="polite">
      <NProgress
        type="line"
        :percentage="Math.min(100, Math.round((loaded / total) * 100))"
        :show-indicator="false"
        :height="2"
        :border-radius="0"
      />
      <p class="mono">{{ mb(loaded) }} / {{ mb(total) }} MB</p>
    </div>

    <div v-else-if="phase === 'error'" class="error">
      <p class="err">没加载成功：{{ errorMsg }}</p>
      <NButton @click="start">重试</NButton>
    </div>
  </section>

  <template v-else>
    <div class="controls">
      <NInput
        v-model:value="q"
        class="kw"
        placeholder="描述你想找的那句话大概在说什么"
        clearable
        autofocus
        :loading="busy"
        @keydown.enter="useExample(q)"
      />
    </div>
    <p class="examples">
      <span class="mute">试试：</span>
      <button v-for="ex in EXAMPLES" :key="ex" class="ex" @click="useExample(ex)">{{ ex }}</button>
    </p>
    <div class="opts">
      <NCheckbox v-model:checked="hideShort">隐藏不足 3 字的</NCheckbox>
      <NCheckbox v-model:checked="withTime">复制时带上时间</NCheckbox>
    </div>

    <template v-if="scored">
      <p class="stat mono">最像的 {{ results.length }} 条（按相似度排序）</p>
      <ul>
        <QuoteRow
          v-for="r in results"
          :key="r.q.i"
          :q="r.q"
          :hl="null"
          :score="r.score"
          @copy="copy"
          @day="onlyDay"
        />
      </ul>
    </template>
  </template>
</template>

<style scoped>
.back {
  margin-bottom: var(--s-4);
  font-size: var(--step--1);
  color: var(--text-mute);
}
.back a:hover {
  color: var(--text);
}

.gate {
  max-width: 44rem;
  padding: var(--s-4);
  border: 1px solid var(--line);
}
.gate-body {
  display: grid;
  gap: var(--s-3);
  margin-top: var(--s-3);
}
.gate-body em {
  font-style: normal;
  text-decoration: underline;
  text-underline-offset: 3px;
}
.gate-body strong {
  font-weight: 500;
}
.mute {
  color: var(--text-mute);
}
.go {
  margin-top: var(--s-4);
}
.loading {
  margin-top: var(--s-4);
}
.loading p {
  margin-top: var(--s-2);
  font-size: var(--step--1);
  color: var(--text-mute);
}
.error {
  margin-top: var(--s-4);
  display: grid;
  gap: var(--s-3);
  justify-items: start;
}
.err {
  margin-top: var(--s-4);
  color: var(--accent);
}
.error .err {
  margin-top: 0;
}

.controls {
  display: flex;
}
.kw {
  max-width: 36rem;
}
.examples {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-2) var(--s-3);
  margin-top: var(--s-3);
  font-size: var(--step--1);
}
.ex {
  padding: 0;
  border: 0;
  background: none;
  color: var(--text);
  font: inherit;
  text-decoration: underline;
  text-decoration-color: var(--line);
  text-underline-offset: 3px;
  cursor: pointer;
}
.ex:hover {
  text-decoration-color: var(--text);
}
.opts {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-3) var(--s-4);
  margin-top: var(--s-4);
}
.stat {
  margin-top: var(--s-5);
  padding-bottom: var(--s-2);
  font-size: var(--step--1);
  color: var(--text-mute);
  border-bottom: 1px solid var(--hairline);
}
</style>
