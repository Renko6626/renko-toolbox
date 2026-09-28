import type { ToolMeta } from '../types'

export default {
  name: '神秘图书馆',
  description: '神秘人的神秘语录，等你来翻。',
  tags: ['语录', '搜索'],
  order: 10,
  subpages: [
    {
      path: 'semantic',
      name: '神秘图书馆 · 按意思找',
      description: '不用记得原话，描述个大概意思就行。模型在你的浏览器里运行，搜索内容不会上传。',
      experimental: true,
      component: () => import('./semantic/Semantic.vue'),
    },
  ],
} satisfies ToolMeta
