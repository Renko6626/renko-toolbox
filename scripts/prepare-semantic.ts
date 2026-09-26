// 构建前跑：只准备模型和 wasm。语录向量是加密的、在本机由 `pnpm encrypt` 生成并入库，CI 不碰明文。
import { ensureModelAssets } from './model-assets.ts'

ensureModelAssets()
