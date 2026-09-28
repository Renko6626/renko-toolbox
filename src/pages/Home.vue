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
    <div class="intro-copy">
      <h1 class="title">工具箱</h1>
      <p class="lede">一些顺手写的小工具，全在浏览器里跑，不上传任何东西。</p>
    </div>
    <p class="count mono"><span class="count-number">{{ count }}</span><span class="count-label">件工具</span></p>
  </section>

  <section class="catalog" aria-label="工具目录">
    <div class="catalog-head">
      <div class="catalog-title">
        <h2>工具目录</h2>
        <span class="mono">{{ String(list.length).padStart(2, '0') }} / {{ count }}</span>
      </div>
      <NInput
        v-if="tools.length"
        v-model:value="q"
        class="search"
        placeholder="按名字、描述或标签筛选"
        clearable
      />
    </div>

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
          <div class="details">
            <h3 class="name">{{ t.name }}</h3>
            <p class="desc">{{ t.description }}</p>
          </div>
          <div v-if="t.tags?.length" class="tags">
            <NTag v-for="tag in t.tags" :key="tag" size="small">{{ tag }}</NTag>
          </div>
          <span class="open-hint mono" aria-hidden="true">查看 ↗</span>
        </RouterLink>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.intro {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--s-5);
  max-width: 1600px;
  margin: 0 auto;
  padding: var(--s-6) var(--page-x) var(--s-6);
  border-bottom: 1px solid var(--hairline);
}
.intro-copy { min-width: 0; }
.title {
  font-size: clamp(3.75rem, 9vw, 6.25rem);
  font-weight: 400;
  line-height: var(--leading-tight);
  letter-spacing: -0.06em;
}
.lede {
  margin-top: var(--s-4);
  max-width: var(--measure-cjk);
  color: var(--text-mute);
}
.count {
  display: flex;
  align-items: baseline;
  gap: var(--s-2);
  margin-bottom: var(--s-1);
  white-space: nowrap;
  color: var(--text-mute);
}
.count-number { font-size: clamp(3rem, 7vw, 5.5rem); line-height: 0.9; color: var(--text); }
.count-label { font-size: var(--step--1); }
.catalog { max-width: 1600px; margin: 0 auto; padding: 0 var(--page-x) var(--s-7); }
.catalog-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--s-3);
  padding: var(--s-4) 0;
  border-bottom: 1px solid var(--line);
}
.catalog-title { display: flex; align-items: baseline; gap: var(--s-3); }
.catalog-title h2 { margin: 0; font-size: var(--step-0); font-weight: 500; }
.catalog-title span { color: var(--text-mute); font-size: var(--step--1); }
.search { width: min(100%, 28rem); }

.row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--s-2) var(--s-3);
  align-items: start;
  padding: var(--s-4) 0;
  border-bottom: 1px solid var(--hairline);
}
.link {
  transition: padding 160ms ease, background-color 160ms ease;
}
.link:hover {
  padding-left: var(--s-2);
  padding-right: var(--s-2);
  background: var(--bg-raise);
}
.link:focus-visible { outline-offset: -3px; }
.path {
  grid-column: 1;
  font-size: var(--step--1);
  color: var(--text-mute);
}
.details { grid-column: 1 / -1; grid-row: 2; }
.name {
  font-size: clamp(1.65rem, 2.3vw, 2.25rem);
  font-weight: 400;
  line-height: 1.2;
}
.desc {
  margin-top: var(--s-2);
  max-width: var(--measure-cjk);
  color: var(--text-mute);
}
.tags {
  grid-column: 1;
  grid-row: 3;
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-2);
  margin-top: var(--s-2);
}
.open-hint { grid-column: 2; grid-row: 1; color: var(--text-mute); font-size: var(--step--1); white-space: nowrap; }
.link:hover .open-hint { color: var(--text); }
.empty {
  grid-template-columns: auto minmax(0, 1fr);
  gap: var(--s-3);
  align-items: baseline;
}
.glyph {
  color: var(--text-mute);
}
code {
  font-size: 0.9em;
  color: var(--text);
}

@media (min-width: 900px) {
  .row {
    grid-template-columns: 12rem minmax(0, 1fr) auto auto;
    column-gap: var(--s-4);
    align-items: start;
    padding: var(--s-5) 0;
  }
  .path { grid-column: 1; grid-row: 1; padding-top: var(--s-1); }
  .details { grid-column: 2; grid-row: 1; }
  .tags { grid-column: 3; grid-row: 1; margin-top: var(--s-1); }
  .open-hint { grid-column: 4; grid-row: 1; padding-top: var(--s-1); }
  .empty { grid-template-columns: 12rem minmax(0, 1fr); }
}
@media (max-width: 599px) {
  .intro { align-items: flex-start; padding-top: var(--s-5); padding-bottom: var(--s-5); }
  .count { align-self: flex-start; flex-direction: column; align-items: flex-end; gap: var(--s-1); }
  .count-number { font-size: 2.5rem; }
  .count-label { font-size: 0.7rem; }
  .lede { margin-top: var(--s-3); }
  .catalog-head { align-items: stretch; }
  .search { width: 100%; }
}
@media (prefers-reduced-motion: reduce) {
  .link { transition: none; }
}
</style>
