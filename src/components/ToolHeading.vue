<script setup lang="ts">
import type { Tool } from '@/tools/types'

defineProps<{ tool: Tool }>()
</script>

<template>
  <div class="heading">
    <div class="heading-inner">
      <p class="path mono">/t/{{ tool.id }}</p>
      <h1 class="name">
        <span class="dot" aria-hidden="true">●</span>{{ tool.name }}
        <span v-if="tool.experimental" class="exp mono">实验性</span>
      </h1>
      <p class="desc">{{ tool.description }}</p>
      <div v-if="tool.tags?.length" class="tags mono" aria-label="工具标签">
        <span v-for="tag in tool.tags" :key="tag">{{ tag }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.heading {
  border-bottom: 1px solid var(--hairline);
}
.heading-inner {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0 var(--s-4);
  max-width: 1600px;
  margin: 0 auto;
  padding: var(--s-5) var(--page-x);
}
.path {
  grid-column: 1 / -1;
  font-size: var(--step--1);
  color: var(--text-mute);
}
.name {
  position: relative;
  grid-column: 1;
  margin-top: var(--s-3);
  font-size: clamp(2.5rem, 5vw, 4.25rem);
  font-weight: 400;
  line-height: var(--leading-tight);
  letter-spacing: -0.035em;
}
/* 点悬挂在栅格线外，标题文字本身仍对齐左边线 */
.dot {
  position: absolute;
  right: 100%;
  top: 50%;
  transform: translateY(-50%);
  margin-right: 0.6em;
  color: var(--accent);
  font-size: 0.3em;
  line-height: 1;
}
.exp {
  margin-left: var(--s-3);
  padding: 2px var(--s-2);
  border: 1px solid var(--line);
  font-size: var(--step--1);
  font-weight: 400;
  color: var(--text-mute);
  vertical-align: middle;
}
.desc {
  grid-column: 1;
  margin-top: var(--s-3);
  max-width: var(--measure-cjk);
  color: var(--text-mute);
}
.tags {
  grid-column: 2;
  grid-row: 2 / 4;
  display: flex;
  align-items: end;
  gap: var(--s-2);
  font-size: var(--step--1);
  color: var(--text-mute);
}
.tags span { padding: 3px var(--s-2); border: 1px solid var(--hairline); }
@media (max-width: 599px) {
  .heading-inner { grid-template-columns: 1fr; }
  .tags { grid-column: 1; grid-row: 4; margin-top: var(--s-3); }
}
</style>
