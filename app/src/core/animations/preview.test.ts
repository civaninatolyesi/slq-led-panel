/**
 * Önayar önizleme aracı (normal test koşusunda atlanır). Panele göndermeden animasyonu görmek için:
 *
 *   bash:       PRESET=dragon-eyes npm run preview:preset
 *   PowerShell: $env:PRESET='dragon-eyes'; npm run preview:preset; Remove-Item Env:PRESET
 *
 * Seçenekler (ortam değişkeni):
 *   PRESET         kimlik, virgülle birden çok kimlik ya da "all"
 *   PRESET_FRAMES  gösterilecek kareler: "0,5,9" ya da "0-4" (varsayılan: hepsi)
 *   PRESET_COLOR   renk seçici değeri, ör. "ff8000" (varsayılan: önayarın rengi)
 *
 * Çıktı: stdout'a renk lejantlı ASCII kareler + özet. Repo kökünde logs/preview/ altına:
 *   <kimlik>.png  LED görünümlü kare tablosu (görsel okuyabilen bir yapay zekâ doğrudan bakabilir)
 *   <kimlik>.gif  panele gidecek GIF'in aynısı (python tools/slq_cli.py gif logs/preview/<kimlik>.gif)
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'
import { describe, it } from 'vitest'
import { H, W, encodeGif, getPx, type Frame } from '../media'
import type { RGB } from '../protocol'
import { PRESETS, getPreset, presetFrames } from './index'

// Not: vitest kendi içinde COLOR=0 ayarlıyor; bu yüzden değişkenler PRESET_ önekli.
const env = process.env
const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../logs/preview')
const SYMBOLS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@$%&*+=?'

const hex = (c: RGB) => c.map((v) => v.toString(16).padStart(2, '0')).join('')
function parseHex(s: string): RGB {
  const h = s.replace(/^#/, '')
  if (!/^[0-9a-f]{6}$/i.test(h)) throw new Error(`PRESET_COLOR "${s}" geçersiz; 6 haneli onaltılık olmalı (ör. ff8000)`)
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB
}

function pickFrames(n: number, spec?: string): number[] {
  if (!spec) return [...Array(n).keys()]
  return spec.split(',').flatMap((part) => {
    const [a, b] = part.split('-').map(Number)
    return b === undefined ? [a] : [...Array(b - a + 1).keys()].map((k) => a + k)
  }).filter((i) => i >= 0 && i < n)
}

/** Her farklı renge bir harf atar ('.' = kapalı LED); lejant RGB değerlerini verir. */
function toAscii(frames: Frame[], idx: number[]): string {
  const sym = new Map<string, string>()
  const symbolOf = (c: RGB) => {
    const k = hex(c)
    if (k === '000000') return '.'
    if (!sym.has(k)) sym.set(k, SYMBOLS[sym.size] ?? '#')
    return sym.get(k)!
  }
  const body = idx.map((i) => {
    const rows = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => symbolOf(getPx(frames[i].px, x, y))).join(''))
    return `#${i}  ${frames[i].delay} ms\n${rows.join('\n')}`
  })
  const legend = [...sym].map(([k, s]) => `${s}=#${k}`).join('  ')
  return `lejant: .=kapalı  ${legend}${sym.size >= SYMBOLS.length ? '  (#=diğer renkler)' : ''}\n\n${body.join('\n\n')}`
}

// ---------------------------------------------------------------- PNG (bağımlılıksız)
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (b: Uint8Array) => {
  let c = 0xffffffff
  for (const v of b) c = CRC_TABLE[(c ^ v) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length)
  const dv = new DataView(out.buffer)
  dv.setUint32(0, data.length)
  out.set(new TextEncoder().encode(type), 4)
  out.set(data, 8)
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)))
  return out
}
function encodePng(w: number, h: number, rgb: Uint8Array): Uint8Array {
  const raw = new Uint8Array(h * (w * 3 + 1))
  for (let y = 0; y < h; y++) raw.set(rgb.subarray(y * w * 3, (y + 1) * w * 3), y * (w * 3 + 1) + 1)
  const ihdr = new Uint8Array(13)
  const dv = new DataView(ihdr.buffer)
  dv.setUint32(0, w)
  dv.setUint32(4, h)
  ihdr.set([8, 2, 0, 0, 0], 8) // 8 bit, RGB
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk('IHDR', ihdr), pngChunk('IDAT', deflateSync(raw)), pngChunk('IEND', new Uint8Array())]
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  parts.reduce((o, p) => (out.set(p, o), o + p.length), 0)
  return out
}

/** Kareleri LED görünümünde tabloya dizer: 4 sütun, her LED 6x6 px, aralarda 1 px boşluk. */
function contactSheet(frames: Frame[], idx: number[]): Uint8Array {
  const LED = 6, PITCH = 7, GAP = 10, COLS = Math.min(4, idx.length)
  const fw = W * PITCH, fh = H * PITCH
  const rows = Math.ceil(idx.length / COLS)
  const w = COLS * fw + (COLS + 1) * GAP, h = rows * fh + (rows + 1) * GAP
  const rgb = new Uint8Array(w * h * 3).fill(40) // koyu gri arka plan
  idx.forEach((fi, n) => {
    const ox = GAP + (n % COLS) * (fw + GAP), oy = GAP + Math.floor(n / COLS) * (fh + GAP)
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const [r, g, b] = getPx(frames[fi].px, x, y)
        const c = r + g + b ? [r, g, b] : [18, 18, 18] // kapalı LED de görünsün
        for (let dy = 0; dy < LED; dy++)
          for (let dx = 0; dx < LED; dx++) rgb.set(c, ((oy + y * PITCH + dy) * w + ox + x * PITCH + dx) * 3)
      }
  })
  return encodePng(w, h, rgb)
}

describe.runIf(env.PRESET)('önizleme', () => {
  // describe gövdesi atlansa da toplama sırasında çalışır; PRESET yoksa boş liste
  const spec = env.PRESET ?? ''
  const ids = spec === 'all' ? PRESETS.map((p) => p.id) : spec.split(',').map((s) => s.trim()).filter(Boolean)
  it.each(ids)('%s', (id) => {
    const p = getPreset(id)
    const frames = presetFrames(p, env.PRESET_COLOR ? parseHex(env.PRESET_COLOR) : undefined)
    const idx = pickFrames(frames.length, env.PRESET_FRAMES)
    const total = frames.reduce((n, f) => n + f.delay, 0)
    mkdirSync(OUT_DIR, { recursive: true })
    const png = resolve(OUT_DIR, `${id}.png`)
    writeFileSync(png, contactSheet(frames, idx))
    const gifBytes = encodeGif(frames)
    const gif = resolve(OUT_DIR, `${id}.gif`)
    writeFileSync(gif, gifBytes)
    const head = `=== ${id} (${p.name.tr}) — ${frames.length} kare, döngü ${(total / 1000).toFixed(2)} sn, GIF ${gifBytes.length} B`
    process.stdout.write(`\n${head}\nPNG: ${png}\nGIF: ${gif}\n${toAscii(frames, idx)}\n`)
  })
})
