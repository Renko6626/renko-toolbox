import type { ToolMeta } from '../types'

export default {
  name: '伪图书馆',
  description: '跃动群里阿伪说过的每一句话。按关键词、月份、日期翻找，带上下文看，一键复制。',
  tags: ['搜索', '群聊'],
  order: 10,
  subpages: [
    {
      path: 'semantic',
      name: '伪图书馆 · 按意思找',
      description: '不用记得原话，描述个大概意思就行。模型在你的浏览器里运行，搜索内容不会上传。',
      experimental: true,
      component: () => import('./semantic/Semantic.vue'),
    },
  ],
} satisfies ToolMeta
