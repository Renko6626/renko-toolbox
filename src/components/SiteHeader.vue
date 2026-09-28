<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()
</script>

<template>
  <header class="header">
    <RouterLink to="/" class="wordmark">Renko / Toolbox</RouterLink>
    <nav class="nav" aria-label="站点">
      <RouterLink v-if="route.name !== 'home'" to="/" class="link">全部工具</RouterLink>
      <a href="https://renko6626.github.io/" class="link">主页</a>
      <a href="https://github.com/Renko6626/renko-toolbox" class="link">源码</a>
    </nav>
  </header>
</template>

<style scoped>
.header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-4);
  padding: var(--s-3) var(--page-x);
  border-bottom: 1px solid var(--hairline);
}
.wordmark {
  font-family: var(--font-mono);
  font-size: var(--step--1);
  letter-spacing: var(--tracking-label);
  text-transform: uppercase;
}
.nav {
  display: flex;
  gap: var(--s-4);
}
.link {
  font-size: var(--step--1);
  color: var(--text-mute);
  white-space: nowrap;
  transition: color 120ms linear;
}
.link:hover {
  color: var(--text);
}
</style>
