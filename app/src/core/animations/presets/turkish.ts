/**
 * Türk bayrağı ve geleneksel motifler. Ay-yıldız 12 px yüksekliğe göre elle çizildi. Kenar yumuşatma panelde
 * pembe/bulanık lekeler bıraktığı için yalnızca tam renkli pikseller kullanılır (palet küçük kalır, GIF de küçük olur).
 */
import { H, type Frame } from '../../media'
import type { RGB } from '../../protocol'
import { Canvas, type Sprite } from '../canvas'
import { mix, rng, scale } from '../color'
import { pushUp, scrollLeft, wave } from '../effects'
import { mirrorRows } from '../sprites'
import { sequence, steps, still } from '../timeline'
import { definePreset } from '../types'

const TR_RED: RGB = [235, 0, 15]
const TR_WHITE: RGB = [255, 255, 255]

/** 12 satırlık hilal (10 sütun); boynuzları yıldıza doğru kıvrılır. */
const CRESCENT: Sprite = mirrorRows(['....#####.', '..########', '.###....##', '###......#', '###.......', '###.......'])
/** 7x7 beş köşeli yıldız; bir köşesi hilale (sola) bakar. */
const STAR: Sprite = ['..#....', '..##.##', '.#####.', '#####..', '.#####.', '..##.##', '..#....']

/** Ay-yıldız: (ox, oy) hilalin sol üstü; 18x12 kaplar. Daha küçüğü 12 px'te okunmuyor (hilal "C", yıldız "+" olur). */
function emblem(g: Canvas, ox: number, oy: number, c: RGB) {
  g.sprite(CRESCENT, ox, oy, c)
  g.sprite(STAR, ox + 11, oy + 2, c)
}

/** Tam ekran bayrak: kırmızı zemin, ortada ay-yıldız. */
function flagFrame(delay: number): Frame {
  return still(delay, (g) => {
    g.fill(TR_RED)
    emblem(g, 15, 0, TR_WHITE)
  })
}

export const turkflag = definePreset({
  id: 'turkflag',
  name: { tr: 'Türk bayrağı', en: 'Turkish flag' },
  tags: ['fun', 'ride'],
  make: () => [flagFrame(1000)],
})

export const turkflagWave = definePreset({
  id: 'turkflag-wave',
  name: { tr: 'Dalgalanan Türk bayrağı', en: 'Waving Turkish flag' },
  tags: ['fun', 'ride'],
  make: () => wave(flagFrame(0), 16, 80, (x) => x),
})

export const turkflagScroll = definePreset({
  id: 'turkflag-scroll',
  name: { tr: 'Kayan Türk bayrakları', en: 'Scrolling Turkish flags' },
  tags: ['fun', 'ride'],
  make: () => {
    // 24 sütunluk karo: 2 boş + 20 sütun bayrak + 2 boş; ekranda yan yana iki bayrak sonsuz kayar
    const tile = Canvas.blank(0)
    tile.fillRect(2, 0, 20, H, TR_RED)
    emblem(tile, 3, 0, TR_WHITE)
    return scrollLeft((x, y) => tile.get(x, y), 24, 55)
  },
})

export const turkflagDuo = definePreset({
  id: 'turkflag-duo',
  name: { tr: 'İki dalgalanan bayrak', en: 'Two waving flags' },
  tags: ['fun', 'ambient'],
  make: () => {
    // Her birim 24 sütun: gönder (1) + bayrak (21) + boşluk (2). İkinci bayrağın dalgası yarım faz geride.
    const src = Canvas.blank(0)
    for (const x0 of [0, 24]) {
      src.fillRect(x0, 0, 1, H, [150, 150, 150])
      src.fillRect(x0 + 1, 0, 21, H, TR_RED)
      emblem(src, x0 + 2, 0, TR_WHITE)
    }
    const along = (x: number) => {
      const d = x % 24
      return d === 0 || d > 21 ? null : d + (x >= 24 ? 9 : 0)
    }
    return wave(src.frame, 16, 80, along, { wavelength: 18, lift: false })
  },
})

export const ayyildizShine = definePreset({
  id: 'ayyildiz-shine',
  name: { tr: 'Parlayan ay yıldız', en: 'Shining crescent & star' },
  tags: ['fun', 'ambient'],
  make: () => {
    // Siyah zeminde kırmızı ay-yıldız: üzerinden çapraz bir parıltı geçer, sonra yıldız parlar
    const base = Canvas.blank(0)
    emblem(base, 15, 0, TR_RED)
    const glint = sequence(16, 50, (g, i) => {
      const band = 14 + i * 1.8
      for (let x = 15; x < 33; x++)
        for (let y = 0; y < H; y++) {
          if (!base.isLit(x, y)) continue
          const dist = Math.abs(x + y * 0.5 - band)
          g.set(x, y, dist < 1 ? TR_WHITE : dist < 2 ? [255, 140, 140] : TR_RED)
        }
    })
    glint[glint.length - 1].delay = 500
    const SPARKS = [[35, 5], [29, 0], [29, 11]]
    const PLUS = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]
    const flash = steps([1, 0.4, 1, 0], (_, j) => (j === 3 ? 900 : 100), (g, k) => {
      g.copyFrom(base)
      g.sprite(STAR, 26, 2, mix(TR_RED, TR_WHITE, k))
      if (k === 1)
        for (const [sx, sy] of SPARKS)
          for (const [dx, dy] of PLUS) g.set(sx + dx, sy + dy, dx || dy ? [255, 120, 120] : TR_WHITE)
    })
    return [...glint, ...flash]
  },
})

export const turkiye = definePreset({
  id: 'turkiye',
  name: { tr: 'TÜRKİYE yazısı ve bayrak', en: 'TÜRKİYE text and flag' },
  tags: ['fun', 'ride'],
  make: () => {
    const flag = flagFrame(1500)
    const word = still(1500, (g) => {
      g.fill(TR_RED)
      g.text('TÜRKİYE', 3, TR_WHITE, 'narrow')
    })
    return [flag, ...pushUp(flag, word), word, ...pushUp(word, flag)]
  },
})

export const turkflagFireworks = definePreset({
  id: 'turkflag-fireworks',
  name: { tr: 'Bayrak ve havai fişek', en: 'Flag with fireworks' },
  tags: ['party', 'fun'],
  make: () => {
    const r = rng(1923)
    const N = 40
    const RISE = 4 // roketin yükselme süresi (kare)
    const BURST = 10 // patlamanın sönme süresi (kare)
    // Ortada 20 sütunluk bayrak; iki yanda sırayla kırmızı ve beyaz havai fişekler
    const bursts = [0, 10, 20, 30].map((t0, k) => ({
      t0,
      x: k % 2 ? 37 + r() * 7 : 3 + r() * 7,
      y: 3 + r() * 3,
      c: (k % 2 ? TR_WHITE : [255, 30, 30]) as RGB,
      dirs: Array.from({ length: 16 }, (_, j) => (j / 16) * Math.PI * 2 + r() * 0.3),
    }))
    return sequence(N, 65, (g, i) => {
      g.fillRect(14, 0, 20, H, TR_RED)
      emblem(g, 15, 0, TR_WHITE)
      for (const b of bursts) {
        const a = (i - b.t0 + N) % N
        if (a < RISE) {
          const y = H - 1 - ((H - 1 - b.y) * (a + 1)) / RISE
          g.set(b.x, y, [255, 200, 120])
          g.set(b.x, y + 1, [120, 70, 30])
        } else if (a < RISE + BURST) {
          const t = a - RISE
          if (t === 0) g.set(b.x, b.y, TR_WHITE)
          // dış halka + daha parlak iç halka; bayrağın üstüne taşan kıvılcımlar çizilmez
          const rad = Math.min(5, 1 + t * 0.9)
          b.dirs.forEach((d, j) => {
            const rr = j % 2 ? rad * 0.55 : rad
            const px = Math.round(b.x + Math.cos(d) * rr)
            if (px >= 13 && px <= 34) return
            g.set(px, b.y + Math.sin(d) * rr * 0.8 + t * t * 0.03, scale(b.c, (j % 2 ? 1.1 : 1) * (1 - t / BURST)))
          })
        }
      }
    })
  },
})

export const kilim = definePreset({
  id: 'kilim',
  name: { tr: 'Kilim motifi', en: 'Kilim motif' },
  tags: ['ambient'],
  make: () => {
    const RED: RGB = [200, 0, 20]
    const CREAM: RGB = [255, 230, 190]
    const GOLD: RGB = [255, 160, 0]
    const NAVY: RGB = [0, 30, 140]
    // 12 sütunluk karo: iç içe baklava (göz) motifi, üst/alt kenarda testere dişi bordür
    const tile = (x: number, y: number): RGB => {
      if (y === 0 || y === 11) return (x % 4 < 2) === (y === 0) ? GOLD : NAVY
      const d = Math.abs(x - 5.5) + Math.abs(y - 5.5)
      if (d < 1.5) return CREAM
      if (d < 2.5) return NAVY
      if (d < 3.5) return GOLD
      if (d < 4.5) return RED
      if (d < 5.5) return CREAM
      return Math.abs(x - 5.5) > 4.5 && Math.abs(y - 5.5) > 3.5 ? NAVY : RED
    }
    return scrollLeft(tile, 12, 110)
  },
})
