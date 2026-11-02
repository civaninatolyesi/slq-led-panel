/**
 * Resim/animasyon verisi: panel ham GIF dosyası alır ve kendisi çözer (48x12).
 * Firmware GIF'e efekt uygulamaz; hareket karelerin içine çizilmelidir. Biçim: docs/protocol/05-data-formats.md#52-gif
 */
import { GIFEncoder, applyPalette, quantize } from 'gifenc'
import { PANEL_H, PANEL_W, type RGB } from './protocol'

export const W = PANEL_W
export const H = PANEL_H
export const MAX_FRAMES = 80

/** Tek kare: 48x12 RGBA ve süre (ms). */
export interface Frame {
  px: Uint8ClampedArray
  delay: number
}

export const blankPixels = () => new Uint8ClampedArray(W * H * 4)

export function makeFrame(delay = 100, fill: RGB = [0, 0, 0]): Frame {
  const px = blankPixels()
  for (let i = 0; i < W * H; i++) px.set([...fill, 255], i * 4)
  return { px, delay }
}

export function setPx(px: Uint8ClampedArray, x: number, y: number, [r, g, b]: RGB): void {
  x = Math.round(x)
  y = Math.round(y)
  if (x < 0 || y < 0 || x >= W || y >= H) return
  const i = (y * W + x) * 4
  px[i] = r
  px[i + 1] = g
  px[i + 2] = b
  px[i + 3] = 255
}

export function getPx(px: Uint8ClampedArray, x: number, y: number): RGB {
  const i = (y * W + x) * 4
  return [px[i], px[i + 1], px[i + 2]]
}

// ---------------------------------------------------------------- GIF kodlama
/**
 * Kareleri 48x12 GIF'e çevirir. Kare başına palet (üretici uygulaması da öyle yapar).
 * Renk sayısı ≤ maxColors ise palet birebir kurulur, değilse niceleme yapılır.
 */
export function encodeGif(frames: Frame[], maxColors = 64): Uint8Array {
  if (!frames.length) throw new Error('en az bir kare gerekli')
  const gif = GIFEncoder()
  frames.forEach((f) => {
    const rgba = new Uint8Array(f.px.buffer.slice(0))
    for (let k = 3; k < rgba.length; k += 4) rgba[k] = 255
    const palette = exactPalette(rgba, maxColors) ?? quantize(rgba, maxColors, { format: 'rgb565' })
    const index = applyPalette(rgba, palette, 'rgb565')
    gif.writeFrame(index, W, H, {
      palette,
      delay: frames.length > 1 ? Math.max(20, f.delay) : 0,
      repeat: frames.length > 1 ? 0 : -1,
    })
  })
  gif.finish()
  return gif.bytes()
}

function exactPalette(rgba: Uint8Array, max: number): number[][] | null {
  const seen = new Map<number, number[]>()
  for (let i = 0; i < rgba.length; i += 4) {
    const k = (rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2]
    if (!seen.has(k)) {
      if (seen.size >= max) return null
      seen.set(k, [rgba[i], rgba[i + 1], rgba[i + 2]])
    }
  }
  const pal = [...seen.values()]
  while (pal.length < 2) pal.push([0, 0, 0])
  return pal
}

// ---------------------------------------------------------------- dosyadan kareler
export type Fit = 'contain' | 'cover' | 'stretch'

export interface Decoded {
  frames: Frame[]
  /** Dosya zaten 48x12 GIF ise baytları olduğu gibi gönderilir. */
  original?: Uint8Array
}

function drawFitted(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  src: CanvasImageSource,
  sw: number,
  sh: number,
  fit: Fit,
): Uint8ClampedArray {
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, W, H)
  ctx.imageSmoothingEnabled = sw > W * 2 || sh > H * 2
  ctx.imageSmoothingQuality = 'high'
  if (fit === 'stretch') ctx.drawImage(src, 0, 0, W, H)
  else {
    const s = fit === 'contain' ? Math.min(W / sw, H / sh) : Math.max(W / sw, H / sh)
    const dw = sw * s
    const dh = sh * s
    ctx.drawImage(src, (W - dw) / 2, (H - dh) / 2, dw, dh)
  }
  return ctx.getImageData(0, 0, W, H).data
}

function smallCanvas() {
  const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(W, H) : document.createElement('canvas')
  c.width = W
  c.height = H
  return c.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D
}

/** GIF/PNG/JPG/WebP (animasyonlu dahil) dosyasını 48x12 karelere çevirir. */
export async function decodeImageFile(file: Blob, fit: Fit = 'contain'): Promise<Decoded> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const isGif = bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46
  const native48 = isGif && (bytes[6] | (bytes[7] << 8)) === W && (bytes[8] | (bytes[9] << 8)) === H
  const ctx = smallCanvas()
  const frames: Frame[] = []
  const type = file.type || (isGif ? 'image/gif' : '')

  const Decoder = (globalThis as { ImageDecoder?: typeof ImageDecoder }).ImageDecoder
  if (Decoder && type && (await Decoder.isTypeSupported(type).catch(() => false))) {
    const dec = new Decoder({ data: bytes, type })
    await dec.tracks.ready
    const count = Math.max(1, dec.tracks.selectedTrack?.frameCount ?? 1)
    const step = Math.max(1, Math.ceil(count / MAX_FRAMES))
    for (let i = 0; i < count; i += step) {
      const { image } = await dec.decode({ frameIndex: i })
      const delay = Math.round(((image.duration ?? 100_000) / 1000) * step)
      frames.push({ px: drawFitted(ctx, image, image.displayWidth, image.displayHeight, fit), delay: delay || 100 })
      image.close()
    }
    dec.close()
  } else {
    const bmp = await createImageBitmap(file)
    frames.push({ px: drawFitted(ctx, bmp, bmp.width, bmp.height, fit), delay: 100 })
    bmp.close()
  }
  return { frames, original: native48 ? bytes : undefined }
}

// ---------------------------------------------------------------- yardımcılar
export function framesEqual(a: Frame[], b: Frame[]): boolean {
  if (a.length !== b.length) return false
  return a.every((f, i) => f.delay === b[i].delay && f.px.every((v, k) => v === b[i].px[k]))
}

export function cloneFrames(f: Frame[]): Frame[] {
  return f.map((x) => ({ px: new Uint8ClampedArray(x.px), delay: x.delay }))
}

/** Kareleri kalıcı saklamak için (localStorage) kompakt base64. */
export function serializeFrames(frames: Frame[]): string {
  const rgb = new Uint8Array(frames.length * W * H * 3 + frames.length * 2)
  let o = 0
  for (const f of frames) {
    rgb[o++] = f.delay >> 8
    rgb[o++] = f.delay & 0xff
    for (let i = 0; i < W * H; i++) {
      rgb[o++] = f.px[i * 4]
      rgb[o++] = f.px[i * 4 + 1]
      rgb[o++] = f.px[i * 4 + 2]
    }
  }
  let s = ''
  for (let i = 0; i < rgb.length; i += 0x8000) s += String.fromCharCode(...rgb.subarray(i, i + 0x8000))
  return btoa(s)
}

export function deserializeFrames(b64: string): Frame[] {
  const bin = atob(b64)
  const per = W * H * 3 + 2
  const frames: Frame[] = []
  for (let o = 0; o + per <= bin.length; o += per) {
    const f = makeFrame((bin.charCodeAt(o) << 8) | bin.charCodeAt(o + 1))
    for (let i = 0; i < W * H; i++) {
      f.px[i * 4] = bin.charCodeAt(o + 2 + i * 3)
      f.px[i * 4 + 1] = bin.charCodeAt(o + 3 + i * 3)
      f.px[i * 4 + 2] = bin.charCodeAt(o + 4 + i * 3)
    }
    frames.push(f)
  }
  return frames
}
