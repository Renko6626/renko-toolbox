import type { Component } from 'vue'

export interface ToolMeta {
  /** 路由段 /#/t/<id>；默认取目录名 */
  id?: string
  name: string
  /** 一句话说清它做什么，首页列表和工具页标题下都会显示 */
  description: string
  tags?: string[]
  /** 首页排序，小的在前；默认 100 */
  order?: number
}

export interface Tool extends Omit<ToolMeta, 'id'> {
  id: string
  component: () => Promise<Component>
}
