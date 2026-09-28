import { onMounted, onUnmounted } from 'vue'
import { imageFileFromClipboardItems, imageFileFromPasteItems } from './image-source'

export function useImageImport(
  loadFile: (file: File) => Promise<void>,
  report: (message: string) => void,
) {
  function chooseFile(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (file) void loadFile(file)
  }

  function handlePaste(event: ClipboardEvent) {
    const file = event.clipboardData && imageFileFromPasteItems(event.clipboardData.items, event.clipboardData.files)
    if (!file) return
    event.preventDefault()
    void loadFile(file)
  }

  async function pasteFromClipboard() {
    if (!navigator.clipboard?.read) {
      report('当前浏览器不支持一键读取图片剪贴板，请使用系统粘贴或选择图片。')
      return
    }
    try {
      const file = await imageFileFromClipboardItems(await navigator.clipboard.read())
      if (file) await loadFile(file)
      else report('剪贴板里没有图片。')
    } catch {
      report('无法读取剪贴板，请允许访问或选择图片。')
    }
  }

  onMounted(() => window.addEventListener('paste', handlePaste))
  onUnmounted(() => window.removeEventListener('paste', handlePaste))

  return { chooseFile, pasteFromClipboard }
}
