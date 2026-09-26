<script setup lang="ts">
import type { Tool } from '@/tools/types'

defineProps<{ tool: Tool }>()
</script>

<template>
  <div class="heading">
    <p class="path mono">/t/{{ tool.id }}</p>
    <h1 class="name">
      <span class="dot" aria-hidden="true">●</span>{{ tool.name }}
      <span v-if="tool.experimental" class="exp mono">实验性</span>
    </h1>
    <p class="desc">{{ tool.description }}</p>
  </div>
</template>

<style scoped>
.heading {
  padding: var(--s-5) var(--page-x) var(--s-4);
  border-bottom: 1px solid var(--hairline);
}
.path {
  font-size: var(--step--1);
  color: var(--text-mute);
}
.name {
  position: relative;
  margin-top: var(--s-2);
  font-size: var(--step-2);
  font-weight: 500;
  line-height: var(--leading-tight);
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
  margin-top: var(--s-3);
  max-width: var(--measure-cjk);
  color: var(--text-mute);
}
</style>
