import type { Component } from 'vue'
import type { Tool, ToolMeta } from './types'

// 约定：每个工具一个目录 src/tools/<id>/，里面放
//   meta.ts   —— export default { name, description, icon, ... } satisfies ToolMeta
//   Tool.vue  —— 工具本体（按需懒加载）
// 放进去就自动出现在首页和路由里，不用改别处。
const metas = import.meta.glob<ToolMeta>('./*/meta.ts', { eager: true, import: 'default' })
const views = import.meta.glob<Component>('./*/Tool.vue', { import: 'default' })

export const tools: Tool[] = Object.entries(metas)
  .map(([path, meta]) => {
    const dir = path.split('/')[1]
    const view = views[`./${dir}/Tool.vue`]
    if (!view) throw new Error(`tools/${dir} 缺少 Tool.vue`)
    return { ...meta, id: meta.id ?? dir, component: view }
  })
  .sort((a, b) => (a.order ?? 100) - (b.order ?? 100) || a.name.localeCompare(b.name))
