/**
 * Paneldeki metin efektlerinin yaklaşık simülasyonu (önizleme). Glifler gönderilen veriden çözülür,
 * yani harf şekilleri birebir aynıdır; efekt zamanlaması yaklaşıktır.
 */
import { H, W, blankPixels, type Frame } from './media'
import { Effect, type RGB } from './protocol'
import type { EncodedText } from './text'

export type Renderer = (t: number) => Uint8ClampedArray

/** Panel gradyanları. Yalnızca 3 donanımda doğrulandı; diğerleri tahmini önizlemedir. */
export const GRADIENTS: Record<number, RGB[]> = {
  1: [[255, 0, 0], [255, 220, 0]],
  2: [[0, 255, 80], [0, 160, 255]],
  3: [[0, 60, 255], [180, 0, 255], [255, 0, 0]],
  4: [[255, 0, 160], [255, 200, 0]],
  5: [[0, 255, 255], [255, 0, 255]],
  6: [[255, 255, 255], [0, 120, 255]],
  7: [[255, 120, 0], [0, 255, 120]],
}
export const VERIFIED_GRADIENTS = new Set([3])

function gradientAt(stops: RGB[], k: number): RGB {
  const p = Math.max(0, Math.min(0.9999, k)) * (stops.length - 1)
  const i = Math.floor(p)
  const f = p - i
  return [0, 1, 2].map((c) => Math.round(stops[i][c] + (stops[i + 1][c] - stops[i][c]) * f)) as RGB
}

interface Strip {
  width: number
  cols: { on: boolean[]; rgb: RGB }[]
  /** Sayfalama için karakter sınırları (sütun indeksi). */
  breaks: number[]
}

function buildStrip(enc: EncodedText): Strip {
  const cols: Strip['cols'] = []
  const breaks: number[] = [0]
  for (const g of enc.glyphs) {
    for (let x = 0; x < g.width; x++) cols.push({ on: g.rows.map((r) => r[x]), rgb: g.rgb })
    breaks.push(cols.length)
  }
  return { width: cols.length, cols, breaks }
}

/** Sayfa = ekrana sığan ardışık karakterler (panel "HELL" | "O" şeklinde böler). */
function pages(s: Strip): [number, number][] {
  const out: [number, number][] = []
  let start = 0
  for (let i = 1; i < s.breaks.length; i++) {
    if (s.breaks[i] - start > W) {
      out.push([start, s.breaks[i - 1]])
      start = s.breaks[i - 1]
    }
  }
  if (start < s.width || !out.length) out.push([start, s.width])
  return out
}

export interface PreviewOpts {
  effect: Effect
  speed: number
  colorIndex: number
  bg: RGB
  vertical: boolean
}

export function textRenderer(enc: EncodedText, o: PreviewOpts): Renderer {
  const s = buildStrip(enc)
  const pg = pages(s)
  const stops = o.colorIndex ? GRADIENTS[o.colorIndex] : null
  const pxPerSec = 6 + o.speed * 0.45
  const pageMs = 3400 - o.speed * 26

  const paint = (px: Uint8ClampedArray, x: number, y: number, col: number, row: number) => {
    if (x < 0 || x >= W || y < 0 || y >= H || col < 0 || col >= s.width) return
    const c = s.cols[col]
    if (!c.on[row]) return
    const rgb = stops ? gradientAt(stops, row / (H - 1)) : c.rgb
    const i = (y * W + x) * 4
    px[i] = rgb[0]
    px[i + 1] = rgb[1]
    px[i + 2] = rgb[2]
  }

  const base = () => {
    const px = blankPixels()
    for (let i = 0; i < W * H; i++) px.set([...o.bg, 255], i * 4)
    return px
  }

  /** startCol..endCol aralığını ekranda (ox, oy) kaydırmasıyla çizer, ortalayarak. */
  const drawRange = (px: Uint8ClampedArray, [a, b]: [number, number], ox: number, oy: number, center = true) => {
    const off = center ? Math.floor((W - (b - a)) / 2) : 0
    for (let col = a; col < b; col++)
      for (let row = 0; row < H; row++) paint(px, off + col - a + ox, row + oy, col, row)
  }

  if (o.vertical) {
    // Dikey yazı: karakterler alt alta, yukarı kayar (yaklaşık)
    return (t) => {
      const px = base()
      const total = enc.glyphs.length * H
      const y0 = Math.floor(((t / 1000) * pxPerSec * 0.6) % (total + H))
      enc.glyphs.forEach((g, i) => {
        const start = s.breaks[i]
        for (let x = 0; x < g.width; x++)
          for (let row = 0; row < H; row++) paint(px, Math.floor((W - g.width) / 2) + x, H + i * H + row - y0, start + x, row)
      })
      return px
    }
  }

  switch (o.effect) {
    case Effect.LEFT:
    case Effect.RIGHT: {
      const span = s.width + W
      return (t) => {
        const px = base()
        const p = Math.floor(((t / 1000) * pxPerSec) % span)
        const ox = o.effect === Effect.LEFT ? W - p : p - s.width
        drawRange(px, [0, s.width], ox, 0, false)
        return px
      }
    }
    case Effect.UP:
    case Effect.DOWN: {
      return (t) => {
        const px = base()
        const cycle = pageMs
        const k = Math.floor(t / cycle) % pg.length
        const f = (t % cycle) / cycle
        const slide = Math.min(1, f * 5)
        const dir = o.effect === Effect.UP ? 1 : -1
        drawRange(px, pg[k], 0, Math.round(dir * H * (1 - slide)))
        if (slide < 1) drawRange(px, pg[(k + pg.length - 1) % pg.length], 0, Math.round(-dir * H * slide))
        return px
      }
    }
    case Effect.LASER: {
      return (t) => {
        const px = base()
        const cycle = pageMs * 1.2
        const k = Math.floor(t / cycle) % pg.length
        const f = (t % cycle) / cycle
        const [a, b] = pg[k]
        const shown = Math.floor(Math.min(1, f * 2.2) * (b - a + 1))
        const off = Math.floor((W - (b - a)) / 2)
        for (let col = a; col < a + shown && col < b; col++) for (let row = 0; row < H; row++) paint(px, off + col - a, row, col, row)
        if (shown <= b - a) {
          const x = off + shown
          for (let y = 0; y < H; y++) if (x < W) px.set([255, 255, 255, 255], (y * W + x) * 4)
        }
        return px
      }
    }
    case Effect.PAGE_5:
    case Effect.PAGE_6: {
      return (t) => {
        const px = base()
        const k = Math.floor(t / pageMs) % pg.length
        const f = (t % pageMs) / pageMs
        const reveal = Math.min(1, f * 4)
        const [a, b] = pg[k]
        const off = Math.floor((W - (b - a)) / 2)
        for (let col = a; col < b; col++)
          for (let row = 0; row < H; row++) {
            const x = off + col - a
            const vis = o.effect === Effect.PAGE_5 ? ((x * 7 + row * 13) % 17) / 17 < reveal : Math.abs(x - W / 2) / (W / 2) < reveal
            if (vis) paint(px, x, row, col, row)
          }
        return px
      }
    }
    default: {
      return (t) => {
        const px = base()
        drawRange(px, pg[Math.floor(t / pageMs) % pg.length], 0, 0)
        return px
      }
    }
  }
}

export function framesRenderer(frames: Frame[]): Renderer {
  const total = frames.reduce((n, f) => n + Math.max(20, f.delay), 0)
  return (t) => {
    if (frames.length === 1) return frames[0].px
    let m = t % total
    for (const f of frames) {
      m -= Math.max(20, f.delay)
      if (m < 0) return f.px
    }
    return frames[0].px
  }
}
