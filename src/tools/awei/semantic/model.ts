// 构建脚本（scripts/prepare-semantic.ts）和浏览器端 worker 共用，两边必须一致，
// 否则预先算好的语录向量和查询向量不在同一个空间里。
export const MODEL = 'Xenova/bge-small-zh-v1.5'
export const DTYPE = 'q8'
export const POOLING = 'cls'
export const MODEL_FILES = [
  'config.json',
  'tokenizer.json',
  'tokenizer_config.json',
  'special_tokens_map.json',
  'onnx/model_quantized.onnx',
]
// 注意：bge-zh 建议给查询加「为这个句子生成表示以用于检索相关文章：」指令，
// 那是为「短查询搜长文档」设计的。群聊消息本身就和查询一样短，实测加了反而更差，所以不加。
