import assert from 'node:assert/strict'
import test from 'node:test'
import { imageFileFromClipboardItems, imageFileFromPasteItems } from './image-source.ts'

test('paste chooses an image file and ignores text', () => {
  const image = new File(['image'], 'copied.png', { type: 'image/png' })
  const items = [
    { kind: 'string', getAsFile: () => null },
    { kind: 'file', getAsFile: () => image },
  ]

  assert.equal(imageFileFromPasteItems(items), image)
})

test('paste returns null when the clipboard contains no image', () => {
  const text = new File(['hello'], 'note.txt', { type: 'text/plain' })
  assert.equal(imageFileFromPasteItems([{ kind: 'file', getAsFile: () => text }]), null)
})

test('paste also accepts browsers that expose the image only through files', () => {
  const image = new File(['image'], 'copied.png', { type: 'image/png' })
  assert.equal(imageFileFromPasteItems([], [image]), image)
})

test('async clipboard read converts image data into a file for the existing loader', async () => {
  const blob = new Blob(['pixels'], { type: 'image/png' })
  const file = await imageFileFromClipboardItems([
    { types: ['text/plain'], getType: async () => new Blob(['text']) },
    { types: ['text/html', 'image/png'], getType: async (type) => {
      assert.equal(type, 'image/png')
      return blob
    } },
  ])

  assert.equal(file?.type, 'image/png')
  assert.equal(await file?.text(), 'pixels')
})

test('async clipboard read returns null without an image item', async () => {
  assert.equal(await imageFileFromClipboardItems([{ types: ['text/plain'], getType: async () => new Blob(['text']) }]), null)
})
