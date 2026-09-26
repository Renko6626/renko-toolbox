<!--
  geometry legend:
    ● 实心点 = 当前正在用的那一件工具（全站唯一的 accent 落点）
    ○ 空心环 = 一个还空着的位置 —— 首页没有工具时的占位行
  结构性元素（发丝分割线、输入框、按钮外框）不参与这套语义，保持沉默。
-->
<script setup lang="ts">
import {
  NConfigProvider,
  NGlobalStyle,
  NMessageProvider,
  NDialogProvider,
  darkTheme,
  zhCN,
  dateZhCN,
} from 'naive-ui'
import SiteHeader from '@/components/SiteHeader.vue'
import ToolHeading from '@/components/ToolHeading.vue'
import { naiveOverrides } from '@/theme/naive-overrides'
</script>

<template>
  <NConfigProvider
    :theme="darkTheme"
    :theme-overrides="naiveOverrides"
    :locale="zhCN"
    :date-locale="dateZhCN"
  >
    <NGlobalStyle />
    <NMessageProvider>
      <NDialogProvider>
        <a class="skip-link" href="#main">跳到正文</a>
        <SiteHeader />
        <main id="main" tabindex="-1">
          <RouterView v-slot="{ Component, route }">
            <template v-if="route.meta.tool">
              <ToolHeading :tool="route.meta.tool" />
              <div class="tool-body">
                <component :is="Component" />
              </div>
            </template>
            <component :is="Component" v-else />
          </RouterView>
        </main>
      </NDialogProvider>
    </NMessageProvider>
  </NConfigProvider>
</template>

<style scoped>
.skip-link {
  position: absolute;
  left: var(--s-4);
  top: var(--s-2);
  padding: var(--s-2) var(--s-3);
  background: var(--text);
  color: var(--bg);
  font-family: var(--font-mono);
  font-size: var(--step--1);
  transform: translateY(-200%);
  z-index: 10;
}
.skip-link:focus {
  transform: none;
}
main:focus {
  outline: none;
}
.tool-body {
  padding: var(--s-5) var(--page-x) var(--s-7);
}
</style>
