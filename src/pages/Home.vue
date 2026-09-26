<script setup lang="ts">
import { computed, ref } from 'vue'
import { NInput, NTag } from 'naive-ui'
import { tools } from '@/tools'

const q = ref('')
const list = computed(() => {
  const k = q.value.trim().toLowerCase()
  if (!k) return tools
  return tools.filter((t) =>
    [t.id, t.name, t.description, ...(t.tags ?? [])].some((s) => s.toLowerCase().includes(k)),
  )
})

const count = String(tools.length).padStart(2, '0')
</script>

<template>
  <section class="intro">
    <h1 class="title">工具箱</h1>
    <p class="count mono">{{ count }} 件</p>
    <p class="lede">一些顺手写的小工具，全在浏览器里跑，不上传任何东西。</p>
    <NInput
      v-if="tools.length"
      v-model:value="q"
      class="search"
      placeholder="按名字、描述或标签筛选"
      clearable
    />
  </section>

  <ul class="index">
    <li v-if="!tools.length" class="row empty">
      <span class="glyph" aria-hidden="true">○</span>
      <div>
        <p class="name">还没有工具</p>
        <p class="desc">在 <code class="mono">src/tools/</code> 下新建一个目录，放进 <code class="mono">meta.ts</code> 和 <code class="mono">Tool.vue</code>，它就会出现在这里。</p>
      </div>
    </li>

    <li v-else-if="!list.length" class="row empty">
      <span class="glyph" aria-hidden="true">○</span>
      <p class="desc">没有匹配「{{ q }}」的工具。</p>
    </li>

    <li v-for="t in list" :key="t.id">
      <RouterLink :to="`/t/${t.id}`" class="row link">
        <span class="path mono">/t/{{ t.id }}</span>
        <div>
          <p class="name">{{ t.name }}</p>
          <p class="desc">{{ t.description }}</p>
        </div>
        <div v-if="t.tags?.length" class="tags">
          <NTag v-for="tag in t.tags" :key="tag" size="small">{{ tag }}</NTag>
        </div>
      </RouterLink>
    </li>
  </ul>
</template>

<style scoped>
.intro {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--s-3);
  padding: var(--s-6) var(--page-x) var(--s-5);
  border-bottom: 1px solid var(--hairline);
}
.title {
  font-size: var(--step-3);
  font-weight: 500;
  line-height: var(--leading-tight);
}
.count {
  font-size: var(--step--1);
  color: var(--text-mute);
}
.lede {
  max-width: var(--measure-cjk);
  color: var(--text-mute);
}
.search {
  max-width: 28rem;
  margin-top: var(--s-3);
}

.row {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--s-2);
  padding: var(--s-4) var(--page-x);
  border-bottom: 1px solid var(--hairline);
}
.link {
  transition: background-color 120ms linear;
}
.link:hover {
  background: var(--bg-raise);
}
.path {
  font-size: var(--step--1);
  color: var(--text-mute);
}
.name {
  font-size: var(--step-1);
  font-weight: 500;
  line-height: 1.3;
}
.desc {
  margin-top: var(--s-1);
  max-width: var(--measure-cjk);
  color: var(--text-mute);
}
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-2);
}
.empty {
  grid-template-columns: auto minmax(0, 1fr);
  gap: var(--s-4);
  align-items: baseline;
}
.glyph {
  color: var(--text-mute);
}
code {
  font-size: 0.9em;
  color: var(--text);
}

/* 宽屏：标题与计数并排，行变成 路径 | 名字+描述 | 标签 三栏 */
@media (min-width: 900px) {
  .intro {
    grid-template-columns: 12rem minmax(0, 1fr);
    column-gap: var(--s-5);
    align-items: end;
  }
  .title { grid-column: 1 / -1; }
  .count { grid-row: 2; grid-column: 1; }
  .lede  { grid-row: 2; grid-column: 2; }
  .search { grid-row: 3; grid-column: 2; }

  .row {
    grid-template-columns: 12rem minmax(0, 1fr) auto;
    column-gap: var(--s-5);
    align-items: baseline;
  }
  .empty {
    grid-template-columns: 12rem minmax(0, 1fr);
  }
}
</style>
