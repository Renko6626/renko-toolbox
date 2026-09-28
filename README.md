# 左右对称

俄苏恶搞小助手。Vue 3 + Naive UI + Vite，全部跑在浏览器里，没有后端。

在线地址：<https://renko6626.github.io/renko-toolbox/>

## 开发

```bash
pnpm install
pnpm dev        # 本地开发
pnpm build      # 类型检查 + 打包到 dist/
```

push 到 `main` 后 GitHub Actions 会自动构建并发布到 Pages。

## 加一个工具

每个工具是 `src/tools/` 下的一个目录，目录名就是路由（`/#/t/<目录名>`）：

```
src/tools/dice/
├── meta.ts    # 名字、描述、标签
└── Tool.vue   # 工具本体，进入时才加载
```

```ts
// src/tools/dice/meta.ts
import type { ToolMeta } from '../types'

export default {
  name: '掷骰子',
  description: '1d6 到 1d100，想掷几个掷几个',
  tags: ['随机'],
} satisfies ToolMeta
```

放进去就会自动出现在首页和路由里，不用改别的文件。工具名和描述由外壳统一渲染成页面标题，
`Tool.vue` 里只写工具本身；可以直接用 `useMessage()` / `useDialog()`，provider 已经挂好。

## 视觉

和 [主页](https://renko6626.github.io/) 同一套 monolith 语言：纯黑、IBM Plex、零圆角、发丝线，
token 在 `src/theme/tokens.css`，naive-ui 的覆盖在 `src/theme/naive-overrides.ts`，两边取值要同步。
唯一的红色（`--accent`）只用在工具页标题前那个点上，别拿它去染按钮。
工具里要用等宽数字就加 `class="mono"`。

## 神秘图书馆：加密的数据

馆藏内容不以明文进仓库，也不以明文上线。仓库和网站上只有 AES-256-GCM 密文，
浏览器里输入密钥后在本地解开（密钥经 PBKDF2-SHA256 10 万次派生，解锁一次 ~30ms）。

| 文件 | 入库？ | 说明 |
| --- | --- | --- |
| `private/awei.txt` | 否 | 明文原始数据 |
| `.env` 的 `AWEI_KEY` | 否 | 密钥，任意文本，区分大小写，不要加引号 |
| `src/tools/awei/data.enc` | 是 | 语录密文 |
| `src/tools/awei/semantic/vectors.enc` | 是 | 语义向量密文（向量也能反推内容，所以一样加密） |

改了语录或换了密钥：

```bash
pnpm encrypt   # 读明文和 .env，重写两个 .enc；然后提交它们
```

CI 构建只下载公开的模型文件，碰不到明文和密钥。
换密钥后，记住旧密钥的设备会自动忘掉它并重新要密钥。
