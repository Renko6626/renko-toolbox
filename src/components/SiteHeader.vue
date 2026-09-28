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
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-3) var(--s-4);
  min-height: 72px;
  padding: var(--s-3) var(--page-x);
  border-bottom: 1px solid var(--hairline);
  background: var(--bg);
}
.wordmark {
  font-family: var(--font-mono);
  font-size: 0.925rem;
  font-weight: 500;
  letter-spacing: 0.02em;
  white-space: nowrap;
}
.nav {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--s-3) var(--s-4);
}
.link {
  font-size: var(--step--1);
  color: var(--text-mute);
  white-space: nowrap;
  text-underline-offset: 5px;
}
.link:hover, .link:focus-visible {
  color: var(--text);
  text-decoration: underline;
}
@media (max-width: 599px) {
  .header { min-height: 64px; }
  .nav { gap: var(--s-3); }
}
</style>
