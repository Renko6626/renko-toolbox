import { ref } from 'vue'
import { useMessage } from 'naive-ui'
import type { Quote } from './parse'

/** 两个页面共用同一个开关，切页面时不会被重置 */
export const withTime = ref(false)

export function useCopy() {
  const message = useMessage()
  return async function copy(x: Quote) {
    const s = withTime.value ? `[${x.time}] 阿伪: ${x.text}` : x.text
    try {
      await navigator.clipboard.writeText(s)
    } catch {
      // 非安全上下文（http 局域网访问）下 clipboard API 不可用，退回老办法
      const ta = document.createElement('textarea')
      ta.value = s
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      if (!ok) return message.error('复制失败，浏览器不允许访问剪贴板')
    }
    message.success('已复制')
  }
}
