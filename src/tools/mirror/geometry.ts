export interface MirrorSegment {
  sourceX: number
  targetX: number
  width: number
  flip: boolean
}

export function mirrorSegments(width: number, axis: number, direction: 'left' | 'right'): {
  outputWidth: number
  segments: MirrorSegment[]
} {
  if (!Number.isInteger(width) || width < 1 || !Number.isInteger(axis * 2) || axis < 0.5 || axis > width - 0.5) {
    throw new RangeError('对称轴必须位于图片内，步长为半个像素')
  }

  if (direction === 'left') {
    const kept = Math.ceil(axis)
    const reflected = Math.floor(axis)
    return {
      outputWidth: kept + reflected,
      segments: [
        { sourceX: 0, targetX: 0, width: kept, flip: false },
        { sourceX: 0, targetX: kept, width: reflected, flip: true },
      ],
    }
  }

  const kept = Math.ceil(width - axis)
  const reflected = Math.floor(width - axis)
  return {
    outputWidth: kept + reflected,
    segments: [
      { sourceX: width - reflected, targetX: 0, width: reflected, flip: true },
      { sourceX: width - kept, targetX: reflected, width: kept, flip: false },
    ],
  }
}
