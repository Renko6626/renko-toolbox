import assert from 'node:assert/strict'
import test from 'node:test'
import { facesFromAnimeRects, facesFromDetections, mergeFaces } from './faces.ts'

test('uses eye midpoint and nose to place a face axis on a half-pixel', () => {
  const faces = facesFromDetections([{
    boundingBox: { originX: 200, originY: 50, width: 100, height: 120 },
    keypoints: [{ x: 0.2, y: 0.2 }, { x: 0.3, y: 0.2 }, { x: 0.251, y: 0.3 }],
    categories: [{ score: 0.9 }],
  }], { width: 1000, height: 500, offsetX: 0, offsetY: 0 }, 1000)

  assert.deepEqual(faces, [{ x: 200, y: 50, width: 100, height: 120, axis: 250.5, score: 0.9 }])
})

test('maps tile detections back to the full image and falls back to box center', () => {
  const faces = facesFromDetections([{
    boundingBox: { originX: 20, originY: 30, width: 81, height: 100 },
    keypoints: [], categories: [{ score: 0.8 }],
  }], { width: 300, height: 200, offsetX: 500, offsetY: 100 }, 1000)

  assert.deepEqual(faces, [{ x: 520, y: 130, width: 81, height: 100, axis: 560.5, score: 0.8 }])
})

test('maps a resized tile detection to original-image pixels', () => {
  const faces = facesFromDetections([{
    boundingBox: { originX: 20, originY: 30, width: 40, height: 50 },
    keypoints: [], categories: [{ score: 0.8 }],
  }], { width: 300, height: 200, offsetX: 500, offsetY: 100, scaleX: 2, scaleY: 2 }, 1200)

  assert.deepEqual(faces, [{ x: 540, y: 160, width: 80, height: 100, axis: 580, score: 0.8 }])
})

test('merges overlapping detections without dropping separate faces', () => {
  const faces = mergeFaces([
    { x: 100, y: 100, width: 80, height: 80, axis: 140, score: 0.7 },
    { x: 103, y: 102, width: 80, height: 80, axis: 142, score: 0.9 },
    { x: 400, y: 110, width: 80, height: 80, axis: 440, score: 0.8 },
  ])

  assert.deepEqual(faces.map((face) => face.axis), [142, 440])
})

test('anime face boxes map back from the detection canvas to the original image', () => {
  const faces = facesFromAnimeRects([
    { x: 10, y: 20, width: 21, height: 30 },
    { x: 80, y: 5, width: 20, height: 20 },
  ], 2, 3, 200)

  assert.deepEqual(faces.map(({ x, y, width, height, axis }) => ({ x, y, width, height, axis })), [
    { x: 20, y: 60, width: 42, height: 90, axis: 41 },
    { x: 160, y: 15, width: 40, height: 60, axis: 180 },
  ])
})
