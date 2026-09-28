declare module 'gifenc' {
  export function GIFEncoder(): {
    writeFrame(pixels: Uint8Array, width: number, height: number, options: {
      palette: number[][]; delay: number; repeat: number; dispose: number;
      transparent: boolean; transparentIndex: number;
    }): void
    finish(): void
    bytes(): Uint8Array<ArrayBuffer>
  }
  export function quantize(data: Uint8ClampedArray, colors: number, options: { format: string; oneBitAlpha: boolean }): number[][]
  export function applyPalette(data: Uint8ClampedArray, palette: number[][], format: string): Uint8Array
}
