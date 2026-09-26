<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { NButton, NCheckbox, NDatePicker, NInput, NRadioButton, NRadioGroup, useMessage } from 'naive-ui'
import raw from './data.txt?raw'
import { parseQuotes, type Quote } from './parse'

const all = parseQuotes(raw)
const DAY = 86_400_000
const PAGE = 100

const q = ref('')
const range = ref<[number, number] | null>(null)
const order = ref<'desc' | 'asc'>('desc')
const withTime = ref(false)
const shown = ref(PAGE)

const terms = computed(() => q.value.trim().toLowerCase().split(/\s+/).filter(Boolean))

const results = computed(() => {
  const [from, to] = range.value ?? [-Infinity, Infinity]
  const ts = terms.value
  const hit = all.filter((x) => {
    if (x.day < from || x.day > to) return false
    const t = x.text.toLowerCase()
    return ts.every((k) => t.includes(k))
  })
  return order.value === 'desc' ? hit.reverse() : hit
})

watch([terms, range, order], () => (shown.value = PAGE))

// 高亮：把命中的片段切出来单独包一层。用正则一次切，避免多个关键词互相覆盖。
const splitter = computed(() => {
  if (!terms.value.length) return null
  const esc = terms.value.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  return new RegExp(`(${esc.join('|')})`, 'gi')
})
function pieces(text: string) {
  const re = splitter.value
  if (!re) return [{ s: text, hit: false }]
  return text.split(re).map((s, idx) => ({ s, hit: idx % 2 === 1 }))
}

function onlyDay(x: Quote) {
  range.value = [x.day, x.day]
}

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

const first = all[0]?.day
const last = all[all.length - 1]?.day
const disabledDate = (ts: number) => ts < first - DAY || ts > last + DAY
</script>

<template>
  <div class="controls">
    <NInput
      v-model:value="q"
      class="kw"
      placeholder="关键词，空格分隔表示同时包含"
      clearable
      autofocus
    />
    <NDatePicker
      v-model:value="range"
      type="daterange"
      class="range"
      clearable
      :is-date-disabled="disabledDate"
      start-placeholder="起始日期"
      end-placeholder="结束日期"
    />
    <NRadioGroup v-model:value="order">
      <NRadioButton value="desc">新的在前</NRadioButton>
      <NRadioButton value="asc">旧的在前</NRadioButton>
    </NRadioGroup>
    <NCheckbox v-model:checked="withTime">复制时带上时间</NCheckbox>
  </div>

  <p class="stat mono">{{ results.length }} / {{ all.length }} 条</p>

  <ul class="list">
    <li v-for="x in results.slice(0, shown)" :key="x.i" class="row">
      <button class="time mono" title="只看这一天" @click="onlyDay(x)">{{ x.time }}</button>
      <p class="text"><template v-for="(p, k) in pieces(x.text)" :key="k"><mark v-if="p.hit">{{ p.s }}</mark><template v-else>{{ p.s }}</template></template></p>
      <NButton size="small" class="copy" @click="copy(x)">复制</NButton>
    </li>
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
  align-items: center;
  gap: var(--s-3);
}
.kw {
  flex: 1 1 18rem;
  max-width: 28rem;
}
.range {
  flex: 1 1 18rem;
  max-width: 28rem;
}
.stat {
  margin-top: var(--s-4);
  padding-bottom: var(--s-2);
  font-size: var(--step--1);
  color: var(--text-mute);
  border-bottom: 1px solid var(--hairline);
}
.row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--s-1) var(--s-4);
  align-items: start;
  padding: var(--s-3) 0;
  border-bottom: 1px solid var(--hairline);
}
.time {
  grid-column: 1 / -1;
  justify-self: start;
  padding: 0;
  border: 0;
  background: none;
  color: var(--text-mute);
  font-size: var(--step--1);
  cursor: pointer;
}
.time:hover {
  color: var(--text);
}
.text {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  max-width: var(--measure-cjk);
}
mark {
  background: var(--text);
  color: var(--bg);
}
.empty {
  padding: var(--s-5) 0;
  color: var(--text-mute);
}
.more {
  margin-top: var(--s-4);
}

@media (min-width: 900px) {
  .row {
    grid-template-columns: 12rem minmax(0, 1fr) auto;
    column-gap: var(--s-5);
    align-items: baseline;
  }
  .time {
    grid-column: auto;
  }
}
</style>
