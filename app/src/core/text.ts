/**
 * Metin verisi kodlama (textStart ile gönderilen içerik). Biçim: docs/protocol/05-data-formats.md
 *
 * Her karakter: TİP | R G B | GLİF
 *   TİP 3 -> 6x12 glif, 12 bayt   (ekrana 8 karakter sığar)
 *   TİP 4 -> 12x12 bitmap, 24 bayt (ekrana 4 karakter sığar)
 * Her iki tipte de glif sütun başına 2 bayttır [üst 8 satır, alt 4 satır], bit7 = en üst satır.
 */
import fontRaw from './font12.json'
import type { RGB } from './protocol'

export const GLYPH_NARROW = 3
export const GLYPH_WIDE = 4

const FONT = fontRaw as Record<string, number[]>

/** Text12.convertToStandardFormat karşılığı. Ham tablo panelde bozuk görünür; bu dönüşüm şarttır. */
export function fontStd(raw: number[]): Uint8Array {
  const out = new Uint8Array(12)
  for (let c = 0; c < 6; c++) {
    let top = 0
    let bot = 0
    for (let r = 0; r < 8; r++) if ((raw[c] >> r) & 1) top |= 0x80 >> (7 - r)
    for (let r = 0; r < 4; r++) if ((raw[c + 6] >> (6 - r)) & 1) bot |= 0x80 >> r
    out[2 * c] = top
    out[2 * c + 1] = bot
  }
  return out
}

/** Glif baytlarını satır dizisine çevirir: rows[y] bit x = piksel (x, y). */
export function glyphToRows(g: Uint8Array, width: number): boolean[][] {
  const rows = Array.from({ length: 12 }, () => new Array<boolean>(width).fill(false))
  for (let x = 0; x < width; x++) {
    const top = g[2 * x]
    const bot = g[2 * x + 1]
    for (let y = 0; y < 8; y++) rows[y][x] = ((top >> (7 - y)) & 1) === 1
    for (let y = 0; y < 4; y++) rows[8 + y][x] = ((bot >> (7 - y)) & 1) === 1
  }
  return rows
}

export function rowsToGlyph(rows: boolean[][], width: number): Uint8Array {
  const out = new Uint8Array(width * 2)
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < 12; y++) {
      if (!rows[y][x]) continue
      if (y < 8) out[2 * x] |= 0x80 >> y
      else out[2 * x + 1] |= 0x80 >> (y - 8)
    }
  }
  return out
}

// ---------------------------------------------------------------- dar Türkçe glifler
// Üretici fontunda yalnızca ASCII var. Türkçe harfleri, temel harfe aksan ekleyerek 6 px genişlikte üretiriz;
// böylece "ŞÜKRÜ" gibi metinler 12 px'lik bitmap boşluklarıyla değil, düzgün dar yazıyla görünür.
type Mark = [x: number, y: number][]
const dots = (y: number, a: number, b: number): Mark => [[a, y], [b, y]]
const cedilla = (x: number): Mark => [[x, 9], [x, 10], [x - 1, 10]]
const breve = (y: number): Mark => [[1, y], [4, y], [2, y + 1], [3, y + 1]]

const COMPOSED: Record<string, [base: string, add: Mark, remove?: Mark]> = {
  'Ç': ['C', cedilla(2)],
  'Ş': ['S', cedilla(2)],
  'Ğ': ['G', breve(0)],
  'Ü': ['U', dots(0, 1, 4)],
  'Ö': ['O', dots(0, 1, 3)],
  'İ': ['I', [[2, 0]]],
  'ç': ['c', cedilla(3)],
  'ş': ['s', cedilla(2)],
  'ğ': ['g', breve(2)],
  'ü': ['u', dots(3, 1, 4)],
  'ö': ['o', dots(3, 1, 4)],
  'ı': ['i', [], [[2, 2]]],
}

let narrowCache: Map<string, Uint8Array> | null = null

function narrowTable(): Map<string, Uint8Array> {
  if (narrowCache) return narrowCache
  const m = new Map<string, Uint8Array>()
  for (const [ch, raw] of Object.entries(FONT)) m.set(ch, fontStd(raw))
  m.set(' ', new Uint8Array(12))
  for (const [ch, [base, add, remove]] of Object.entries(COMPOSED)) {
    const rows = glyphToRows(m.get(base)!, 6)
    for (const [x, y] of add) rows[y][x] = true
    for (const [x, y] of remove ?? []) rows[y][x] = false
    m.set(ch, rowsToGlyph(rows, 6))
  }
  narrowCache = m
  return m
}

export const hasNarrowGlyph = (ch: string) => narrowTable().has(ch)

// ---------------------------------------------------------------- geniş (12x12) bitmap
export type Rasterizer = (ch: string) => boolean[][] // 12x12

let canvasCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null

/** Karakteri 12x12 çizer (Python istemcisindeki Arial 11 px karşılığı); kenar yumuşatma eşiklenir. */
export const canvasRasterizer: Rasterizer = (ch) => {
  if (!canvasCtx) {
    const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(12, 12) : document.createElement('canvas')
    c.width = 12
    c.height = 12
    canvasCtx = c.getContext('2d', { willReadFrequently: true }) as typeof canvasCtx
  }
  const ctx = canvasCtx!
  ctx.clearRect(0, 0, 12, 12)
  ctx.fillStyle = '#fff'
  ctx.font = '11px Arial, "Liberation Sans", Roboto, "Segoe UI Emoji", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(ch, 6, 6.5)
  const px = ctx.getImageData(0, 0, 12, 12).data
  return Array.from({ length: 12 }, (_, y) =>
    Array.from({ length: 12 }, (_, x) => {
      const i = (y * 12 + x) * 4
      return Math.max(px[i], px[i + 1], px[i + 2]) * (px[i + 3] / 255) > 110
    }),
  )
}

// ---------------------------------------------------------------- kodlama
export type GlyphMode = 'narrow' | 'wide'

export interface EncodedText {
  data: Uint8Array
  /** Önizleme için: her karakterin genişliği ve satırları. */
  glyphs: { width: number; rows: boolean[][]; rgb: RGB }[]
}

/**
 * mode 'narrow': dar glifi olan karakterler TİP 3, diğerleri TİP 4 (Python'daki "mixed" ile aynı fikir).
 * mode 'wide'  : her karakter TİP 4.
 * color: tek renk ya da karakter başına renk fonksiyonu.
 */
export function encodeText(
  text: string,
  color: RGB | ((i: number, n: number) => RGB),
  mode: GlyphMode = 'narrow',
  raster: Rasterizer = canvasRasterizer,
): EncodedText {
  const chars = Array.from(text)
  const table = narrowTable()
  const parts: number[] = []
  const glyphs: EncodedText['glyphs'] = []
  chars.forEach((ch, i) => {
    const rgb = typeof color === 'function' ? color(i, chars.length) : color
    const narrow = mode === 'narrow' ? table.get(ch) : undefined
    if (narrow) {
      parts.push(GLYPH_NARROW, ...rgb, ...narrow)
      glyphs.push({ width: 6, rows: glyphToRows(narrow, 6), rgb })
    } else {
      const rows = ch === ' ' ? Array.from({ length: 12 }, () => new Array(12).fill(false)) : raster(ch)
      parts.push(GLYPH_WIDE, ...rgb, ...rowsToGlyph(rows, 12))
      glyphs.push({ width: 12, rows, rgb })
    }
  })
  return { data: Uint8Array.from(parts), glyphs }
}

/** HSV gökkuşağı: karakter başına renk için. */
export function rainbow(i: number, n: number, offset = 0): RGB {
  const h = ((i / Math.max(1, n)) * 360 + offset) % 360
  return hsv(h, 1, 1)
}

export function hsv(h: number, s: number, v: number): RGB {
  const f = (n: number) => {
    const k = (n + h / 60) % 6
    return Math.round((v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255)
  }
  return [f(5), f(3), f(1)]
}
