import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import { tools } from './tools'
import type { Tool } from './tools/types'
import Home from './pages/Home.vue'

declare module 'vue-router' {
  interface RouteMeta {
    tool?: Tool
  }
}

const toolRoutes: RouteRecordRaw[] = tools.flatMap((t) => [
  { path: `/t/${t.id}`, name: t.id, component: t.component, meta: { tool: t } },
  ...(t.subpages ?? []).map((sp) => {
    const id = `${t.id}/${sp.path}`
    const sub: Tool = { ...t, id, name: sp.name, description: sp.description, experimental: sp.experimental, component: sp.component as Tool['component'] }
    return { path: `/t/${id}`, name: id, component: sub.component, meta: { tool: sub } }
  }),
])

// GitHub Pages 没有 SPA fallback，用 hash 路由省掉 404.html 那套把戏
export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: Home },
    ...toolRoutes,
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  // 只有换页面才回顶；同一页改 query（搜索条件同步进 URL）时不动
  scrollBehavior: (to, from) => (to.path !== from.path ? { top: 0 } : false),
})

router.afterEach((to) => {
  document.title = to.meta.tool ? `${to.meta.tool.name} · 左右对称` : '左右对称'
})
