declare module 'gifenc' {
  type Palette = number[][]
  interface FrameOpts {
    palette?: Palette
    delay?: number
    repeat?: number
    transparent?: boolean
    transparentIndex?: number
    dispose?: number
    first?: boolean
  }
  interface Encoder {
    writeFrame(index: Uint8Array, width: number, height: number, opts?: FrameOpts): void
    finish(): void
    bytes(): Uint8Array
  }
  export function GIFEncoder(opts?: { auto?: boolean }): Encoder
  export function quantize(rgba: Uint8Array | Uint8ClampedArray, maxColors: number, opts?: { format?: string }): Palette
  export function applyPalette(rgba: Uint8Array | Uint8ClampedArray, palette: Palette, format?: string): Uint8Array
}

interface ImportMetaEnv {
  readonly VITE_APP_VERSION?: string
  readonly VITE_REPO_URL?: string
}
