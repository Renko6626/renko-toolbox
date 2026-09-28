interface PasteItem {
  kind: string
  getAsFile(): File | null
}

interface RichClipboardItem {
  types: readonly string[]
  getType(type: string): Promise<Blob>
}

export function imageFileFromPasteItems(items: ArrayLike<PasteItem>, files: ArrayLike<File> = []): File | null {
  for (const item of Array.from(items)) {
    if (item.kind !== 'file') continue
    const file = item.getAsFile()
    if (file?.type.startsWith('image/')) return file
  }
  for (const file of Array.from(files)) {
    if (file.type.startsWith('image/')) return file
  }
  return null
}

export async function imageFileFromClipboardItems(items: readonly RichClipboardItem[]): Promise<File | null> {
  for (const item of items) {
    const type = item.types.find((candidate) => candidate.startsWith('image/'))
    if (!type) continue
    const blob = await item.getType(type)
    return new File([blob], 'clipboard-image', { type })
  }
  return null
}
