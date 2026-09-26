import type { Component } from 'vue'

export interface SubPage {
  /** 挂在工具路由下：/#/t/<工具 id>/<path> */
  path: string
  name: string
  description: string
  /** 标题旁显示「实验性」 */
  experimental?: boolean
  /** 用动态 import，保证子页面代码按需加载 */
  component: () => Promise<Component | { default: Component }>
}

export interface ToolMeta {
  /** 路由段 /#/t/<id>；默认取目录名 */
  id?: string
  name: string
  /** 一句话说清它做什么，首页列表和工具页标题下都会显示 */
  description: string
  tags?: string[]
  /** 首页排序，小的在前；默认 100 */
  order?: number
  /** 同一个工具下的附属页面，不在首页单独列出 */
  subpages?: SubPage[]
}

export interface Tool extends Omit<ToolMeta, 'id'> {
  id: string
  component: () => Promise<Component>
  experimental?: boolean
}
