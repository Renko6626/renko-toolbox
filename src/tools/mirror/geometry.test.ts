import assert from 'node:assert/strict'
import test from 'node:test'
import { mirrorSegments } from './geometry.ts'

function columns(width: number, axis: number, direction: 'left' | 'right'): number[] {
  const plan = mirrorSegments(width, axis, direction)
  const result = Array<number>(plan.outputWidth).fill(-1)
  for (const segment of plan.segments) {
    for (let x = 0; x < segment.width; x++) {
      result[segment.targetX + x] = segment.flip
        ? segment.sourceX + segment.width - 1 - x
        : segment.sourceX + x
    }
  }
  return result
}

test('even-width center keeps output width and mirrors the selected half', () => {
  assert.deepEqual(columns(4, 2, 'left'), [0, 1, 1, 0])
  assert.deepEqual(columns(4, 2, 'right'), [3, 2, 2, 3])
})

test('odd-width center keeps the center pixel only once', () => {
  assert.deepEqual(columns(5, 2.5, 'left'), [0, 1, 2, 1, 0])
  assert.deepEqual(columns(5, 2.5, 'right'), [4, 3, 2, 3, 4])
})

test('moving axis changes output width to twice the retained side', () => {
  assert.deepEqual(columns(5, 1.5, 'left'), [0, 1, 0])
  assert.deepEqual(columns(5, 1.5, 'right'), [4, 3, 2, 1, 2, 3, 4])
  assert.deepEqual(columns(5, 3, 'left'), [0, 1, 2, 2, 1, 0])
})

test('single-column images remain one column', () => {
  assert.deepEqual(columns(1, 0.5, 'left'), [0])
  assert.deepEqual(columns(1, 0.5, 'right'), [0])
})
