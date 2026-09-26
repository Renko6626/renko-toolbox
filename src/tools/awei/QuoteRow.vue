<script setup lang="ts">
import { computed, ref } from 'vue'
import { NButton } from 'naive-ui'
import type { Quote } from './parse'
import { pieces } from './search'
import { quotes } from './vault'

const CTX = 5

const props = defineProps<{ q: Quote; hl: RegExp | null; score?: number }>()
const emit = defineEmits<{ copy: [q: Quote]; day: [q: Quote] }>()

const open = ref(false)
const around = computed(() => quotes.value!.slice(Math.max(0, props.q.i - CTX), props.q.i + CTX + 1))
</script>

<template>
  <li class="row">
    <div class="meta">
      <button class="time mono" title="只看这一天" @click="emit('day', q)">{{ q.time }}</button>
      <span v-if="score !== undefined" class="score mono" title="语义相似度，越接近 1 越像">{{ score.toFixed(2) }}</span>
    </div>
    <p class="text"><template v-for="(p, k) in pieces(q.text, hl)" :key="k"><mark v-if="p.hit">{{ p.s }}</mark><template v-else>{{ p.s }}</template></template></p>
    <div class="acts">
      <NButton size="small" quaternary :aria-expanded="open" @click="open = !open">{{ open ? '收起' : '上下文' }}</NButton>
      <NButton size="small" @click="emit('copy', q)">复制</NButton>
    </div>

    <ol v-if="open" class="ctx">
      <li v-for="c in around" :key="c.i" :class="{ self: c.i === q.i }">
        <span class="mono">{{ c.time.slice(5) }}</span>
        <p>{{ c.text }}</p>
        <button v-if="c.i !== q.i" class="mini" @click="emit('copy', c)">复制</button>
      </li>
    </ol>
  </li>
</template>

<style scoped>
.row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--s-1) var(--s-4);
  align-items: start;
  padding: var(--s-3) 0;
  border-bottom: 1px solid var(--hairline);
}
.meta {
  grid-column: 1 / -1;
  display: flex;
  gap: var(--s-3);
  align-items: baseline;
}
.score {
  font-size: var(--step--1);
  color: var(--text);
}
.time {
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
.acts {
  display: flex;
  gap: var(--s-2);
}

/* 上下文：缩进到正文那一栏，左侧一条发丝线表示「这一段属于上面那条」 */
.ctx {
  grid-column: 1 / -1;
  margin-top: var(--s-2);
  padding-left: var(--s-3);
  border-left: 1px solid var(--line);
  font-size: var(--step--1);
  color: var(--text-mute);
}
.ctx li {
  display: grid;
  grid-template-columns: 7.5rem minmax(0, 1fr) auto;
  gap: var(--s-3);
  padding: var(--s-1) 0;
  align-items: baseline;
}
.ctx li.self {
  color: var(--text);
}
.ctx p {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.mini {
  padding: 0;
  border: 0;
  background: none;
  color: var(--text-mute);
  font: inherit;
  cursor: pointer;
  opacity: 0;
}
.ctx li:hover .mini,
.mini:focus-visible {
  opacity: 1;
}
.mini:hover {
  color: var(--text);
}
@media (hover: none) {
  .mini { opacity: 1; }
}

@media (min-width: 900px) {
  .row {
    grid-template-columns: 12rem minmax(0, 1fr) auto;
    column-gap: var(--s-5);
    align-items: baseline;
  }
  .meta {
    grid-column: auto;
    flex-direction: column;
    gap: 0;
  }
  .ctx {
    grid-column: 2 / -1;
  }
}
</style>
