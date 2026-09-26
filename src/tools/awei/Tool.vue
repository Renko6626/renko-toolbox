<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NButton, NCheckbox, NDatePicker, NInput, NRadioButton, NRadioGroup, useMessage } from 'naive-ui'
import type { Quote } from './parse'
import { matches, norm, parseQuery } from './search'
import { all, months } from './data'
import QuoteRow from './QuoteRow.vue'

const PAGE = 100

// 预先算好归一化文本和「有效长度」（去掉标点、符号、空白后的字数）
const normed = all.map((x) => norm(x.text))
const bare = all.map((x) => x.text.replace(/[\p{P}\p{S}\s]/gu, '').length)

// ---- 状态与 URL 同步：搜索条件写进 #/t/awei?q=…&from=…&to=…&short=1，可以直接分享 ----
const route = useRoute()
const router = useRouter()

const fmt = (ts: number) => {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const parseDay = (s: unknown) => {
  const m = typeof s === 'string' && /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  return m ? new Date(+m[1], +m[2] - 1, +m[3]).getTime() : null
}

const q = ref(typeof route.query.q === 'string' ? route.query.q : '')
const from0 = parseDay(route.query.from)
const to0 = parseDay(route.query.to)
const range = ref<[number, number] | null>(from0 !== null && to0 !== null ? [from0, to0] : null)
const hideShort = ref(route.query.short === '1')
const order = ref<'desc' | 'asc'>(route.query.order === 'asc' ? 'asc' : 'desc')
const withTime = ref(false)
const shown = ref(PAGE)
const picked = ref<Quote | null>(null)

watch([q, range, hideShort, order], () => {
  shown.value = PAGE
  const query: Record<string, string> = {}
  if (q.value.trim()) query.q = q.value.trim()
  if (range.value) {
    query.from = fmt(range.value[0])
    query.to = fmt(range.value[1])
  }
  if (hideShort.value) query.short = '1'
  if (order.value === 'asc') query.order = 'asc'
  router.replace({ query })
})

// ---- 筛选 ----
const parsed = computed(() => parseQuery(q.value))

const results = computed(() => {
  const [from, to] = range.value ?? [-Infinity, Infinity]
  const pq = parsed.value
  const hit = all.filter(
    (x) =>
      x.day >= from &&
      x.day <= to &&
      (!hideShort.value || bare[x.i] >= 3) &&
      matches(pq, x.text, normed[x.i]),
  )
  return order.value === 'desc' ? hit.reverse() : hit
})

// ---- 月份条：点一下只看那个月，再点取消 ----
const activeMonth = computed(() =>
  range.value ? months.find((m) => m.from === range.value![0] && m.to === range.value![1])?.key : undefined,
)
function toggleMonth(m: (typeof months)[number]) {
  range.value = activeMonth.value === m.key ? null : [m.from, m.to]
}

function onlyDay(x: Quote) {
  range.value = [x.day, x.day]
}

function pick() {
  const pool = results.value
  if (pool.length) picked.value = pool[Math.floor(Math.random() * pool.length)]
}

// ---- 复制 ----
const message = useMessage()
async function copy(x: Quote) {
  const s = withTime.value ? `[${x.time}] 阿伪: ${x.text}` : x.text
  try {
    await navigator.clipboard.writeText(s)
  } catch {
    // 非安全上下文（http 局域网访问）下 clipboard API 不可用，退回老办法
    const ta = document.createElement('textarea')
    ta.value = s
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    if (!ok) return message.error('复制失败，浏览器不允许访问剪贴板')
  }
  message.success('已复制')
}

// ---- 按 / 聚焦搜索框 ----
const input = ref<InstanceType<typeof NInput> | null>(null)
function onKey(e: KeyboardEvent) {
  const t = e.target as HTMLElement
  if (e.key === '/' && !/^(INPUT|TEXTAREA)$/.test(t.tagName) && !t.isContentEditable) {
    e.preventDefault()
    input.value?.focus()
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="controls">
    <NInput
      ref="input"
      v-model:value="q"
      class="kw"
      placeholder="搜点什么（按 / 聚焦）"
      clearable
      autofocus
      :status="parsed.error ? 'error' : undefined"
    />
    <NDatePicker
      v-model:value="range"
      type="daterange"
      class="range"
      clearable
      start-placeholder="起始日期"
      end-placeholder="结束日期"
    />
  </div>
  <p class="hint" :class="{ err: parsed.error }">
    <template v-if="parsed.error">{{ parsed.error }}</template>
    <template v-else>
      空格 = 同时包含　<code>a|b</code> = 任一　<code>-词</code> = 排除　<code>/正则/</code> = 正则
    </template>
  </p>

  <div class="months" role="group" aria-label="按月份筛选">
    <button
      v-for="m in months"
      :key="m.key"
      class="month"
      :class="{ on: activeMonth === m.key }"
      :aria-pressed="activeMonth === m.key"
      @click="toggleMonth(m)"
    >
      <span class="mono">{{ m.key }}</span>
      <span class="mono n">{{ m.count }}</span>
    </button>
  </div>

  <div class="opts">
    <NRadioGroup v-model:value="order" size="small">
      <NRadioButton value="desc">新的在前</NRadioButton>
      <NRadioButton value="asc">旧的在前</NRadioButton>
    </NRadioGroup>
    <NCheckbox v-model:checked="hideShort">隐藏不足 3 字的</NCheckbox>
    <NCheckbox v-model:checked="withTime">复制时带上时间</NCheckbox>
    <NButton size="small" :disabled="!results.length" @click="pick">随便翻一条</NButton>
  </div>

  <section v-if="picked" class="picked" aria-label="随机抽到的一条">
    <div class="picked-head">
      <span class="eyebrow">翻到了</span>
      <button class="close" @click="picked = null">收起</button>
    </div>
    <ul><QuoteRow :key="picked.i" :q="picked" :hl="null" @copy="copy" @day="onlyDay" /></ul>
  </section>

  <p class="stat mono">{{ results.length }} / {{ all.length }} 条</p>

  <ul class="list">
    <QuoteRow
      v-for="x in results.slice(0, shown)"
      :key="x.i"
      :q="x"
      :hl="parsed.highlight"
      @copy="copy"
      @day="onlyDay"
    />
    <li v-if="!results.length" class="empty">没有符合条件的语录。换个关键词，或者清掉日期范围。</li>
  </ul>

  <NButton v-if="results.length > shown" class="more" @click="shown += PAGE">
    再显示 {{ Math.min(PAGE, results.length - shown) }} 条（还剩 {{ results.length - shown }}）
  </NButton>
</template>

<style scoped>
.controls {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-3);
}
.kw,
.range {
  flex: 1 1 18rem;
  max-width: 28rem;
}
.hint {
  margin-top: var(--s-2);
  font-size: var(--step--1);
  color: var(--text-mute);
}
.hint.err {
  color: var(--accent);
}
code {
  font-family: var(--font-mono);
  color: var(--text);
}

.months {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(6.5rem, 1fr));
  margin-top: var(--s-4);
  border-top: 1px solid var(--hairline);
  border-left: 1px solid var(--hairline);
}
.month {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: var(--s-2) var(--s-3);
  border: 0;
  border-right: 1px solid var(--hairline);
  border-bottom: 1px solid var(--hairline);
  background: none;
  color: var(--text);
  font-size: var(--step--1);
  cursor: pointer;
  transition: background-color 120ms linear;
}
.month:hover {
  background: var(--bg-raise);
}
.month .n {
  color: var(--text-mute);
}
.month.on {
  background: var(--text);
  color: var(--bg);
}
.month.on .n {
  color: var(--bg);
}

.opts {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s-3) var(--s-4);
  margin-top: var(--s-4);
}

.picked {
  margin-top: var(--s-4);
  padding: var(--s-3) var(--s-3) 0;
  border: 1px solid var(--line);
}
.picked-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.picked :deep(.row) {
  border-bottom: 0;
}
.close {
  padding: 0;
  border: 0;
  background: none;
  color: var(--text-mute);
  font-size: var(--step--1);
  cursor: pointer;
}
.close:hover {
  color: var(--text);
}

.stat {
  margin-top: var(--s-5);
  padding-bottom: var(--s-2);
  font-size: var(--step--1);
  color: var(--text-mute);
  border-bottom: 1px solid var(--hairline);
}
.empty {
  padding: var(--s-5) 0;
  color: var(--text-mute);
}
.more {
  margin-top: var(--s-4);
}
</style>
