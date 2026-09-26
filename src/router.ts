import { createRouter, createWebHashHistory } from 'vue-router'
import { tools } from './tools'
import type { Tool } from './tools/types'
import Home from './pages/Home.vue'

declare module 'vue-router' {
  interface RouteMeta {
    tool?: Tool
  }
}

// GitHub Pages 没有 SPA fallback，用 hash 路由省掉 404.html 那套把戏
export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: Home },
    ...tools.map((t) => ({
      path: `/t/${t.id}`,
      name: t.id,
      component: t.component,
      meta: { tool: t },
    })),
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

router.afterEach((to) => {
  document.title = to.meta.tool ? `${to.meta.tool.name} · Toolbox` : 'Toolbox · Renko'
})
