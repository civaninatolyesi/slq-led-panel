/**
 * Canvas: tek bir 48x12 karenin (Frame) üzerinde çizim yapan ince sarmalayıcı. Kare verisinin kendisi
 * (Frame) GIF kodlayıcı, stüdyo ve önizleme tarafından ortak kullanılır; Canvas yalnızca çizim davranışını ekler.
 */
import { H, W, getPx, makeFrame, setPx, type Frame } from '../media'
import type { RGB } from '../protocol'
import { encodeText, type GlyphMode } from '../text'
import { BLACK } from './color'

/** Karakter deseni: '.' ve ' ' boş, diğer her karakter bir piksel. */
export type Sprite = readonly string[]
/** Desen rengi: tek renk ya da karaktere göre renk (null = o karakteri çizme). */
export type SpriteColor = RGB | ((ch: string) => RGB | null)
/** Piksel başına renk fonksiyonu; null/undefined dönen piksele dokunulmaz. */
export type Shader = (x: number, y: number) => RGB | null | undefined

export class Canvas {
  static readonly W = W
  static readonly H = H

  constructor(readonly frame: Frame) {}

  /** Var olan bir karenin üzerinde çizim yapmak (ya da okumak) için. */
  static of(frame: Frame): Canvas {
    return new Canvas(frame)
  }

  /** Boş (ya da fill ile dolu) yeni kare. */
  static blank(delay = 100, fill: RGB = BLACK): Canvas {
    return new Canvas(makeFrame(delay, fill))
  }

  /** Karenin ekranda kalma süresi (ms). */
  get delay(): number {
    return this.frame.delay
  }
  set delay(ms: number) {
    this.frame.delay = ms
  }

  /** Koordinatlar yuvarlanır; ekran dışı çizimler sessizce yok sayılır. */
  set(x: number, y: number, c: RGB): void {
    setPx(this.frame.px, x, y, c)
  }

  /** Ekran dışı için siyah döner. */
  get(x: number, y: number): RGB {
    x = Math.round(x)
    y = Math.round(y)
    return x < 0 || y < 0 || x >= W || y >= H ? BLACK : getPx(this.frame.px, x, y)
  }

  isLit(x: number, y: number): boolean {
    const [r, g, b] = this.get(x, y)
    return r + g + b > 0
  }

  fill(c: RGB): void {
    this.fillRect(0, 0, W, H, c)
  }

  fillRect(x0: number, y0: number, w: number, h: number, c: RGB): void {
    for (let x = x0; x < x0 + w; x++) for (let y = y0; y < y0 + h; y++) this.set(x, y, c)
  }

  /** Tüm ekranı piksel fonksiyonuyla boyar (gökkuşağı, plazma gibi tam ekran efektler için). */
  paint(shader: Shader): void {
    for (let x = 0; x < W; x++)
      for (let y = 0; y < H; y++) {
        const c = shader(x, y)
        if (c) this.set(x, y, c)
      }
  }

  /** Karakter desenini (ox, oy) sol üst köşesine çizer. */
  sprite(rows: Sprite, ox: number, oy: number, color: SpriteColor): void {
    rows.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        if (ch === '.' || ch === ' ') return
        const c = typeof color === 'function' ? color(ch) : color
        if (c) this.set(ox + x, oy + y, c)
      }),
    )
  }

  /** Panel fontuyla yazı yazar (12 px yükseklik, y = 0). Sonraki karakterin x'ini döndürür. */
  text(s: string, x: number, c: RGB, mode: GlyphMode = 'narrow'): number {
    for (const g of encodeText(s, c, mode).glyphs) {
      g.rows.forEach((row, y) => row.forEach((on, dx) => on && this.set(x + dx, y, c)))
      x += g.width
    }
    return x
  }

  /** Başka bir karenin piksellerini bu kareye kopyalar (süre kopyalanmaz). */
  copyFrom(src: Canvas | Frame): void {
    this.frame.px.set((src instanceof Canvas ? src.frame : src).px)
  }
}
