/** Tam ekran ortam ve parti efektleri. */
import { H, W, type Frame } from '../../media'
import { hsv, rng, scale } from '../color'
import { sequence, still } from '../timeline'
import { definePreset } from '../types'

export const rainbow = definePreset({
  id: 'rainbow',
  name: { tr: 'Gökkuşağı dalgası', en: 'Rainbow wave' },
  tags: ['party', 'ambient'],
  make: () => sequence(24, 70, (g, i) => g.paint((x, y) => hsv((x * 7.5 + y * 6 + i * 15) % 360, 1, 1))),
})

export const fire = definePreset({
  id: 'fire',
  name: { tr: 'Alev', en: 'Fire' },
  tags: ['fun', 'party'],
  make: () => {
    const WARMUP = 16 // alev tabandan yükselip oturana kadar geçen kareler gösterilmez
    const r = rng(7)
    // heat[H] ekranın altındaki görünmez "kor" satırı; her satır alttakilerin ortalamasından soğuyarak oluşur
    const heat = Array.from({ length: H + 1 }, () => new Float32Array(W))
    const out: Frame[] = []
    for (let i = 0; i < 40; i++) {
      for (let x = 0; x < W; x++) heat[H][x] = r() > 0.35 ? 1 : 0.2 + r() * 0.3
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const a = heat[y + 1][(x + W - 1) % W] + heat[y + 1][x] * 2 + heat[y + 1][(x + 1) % W]
          heat[y][x] = Math.max(0, a / 4 - 0.055 - r() * 0.04)
        }
      if (i < WARMUP) continue
      out.push(
        still(70, (g) =>
          g.paint((x, y) => {
            const t = heat[y][x]
            return [Math.min(255, t * 420), Math.min(255, t * t * 300), Math.min(255, t ** 4 * 160)]
          }),
        ),
      )
    }
    return out
  },
})

export const matrix = definePreset({
  id: 'matrix',
  name: { tr: 'Dijital yağmur', en: 'Digital rain' },
  tags: ['ambient'],
  color: [0, 255, 70],
  make: (c) => {
    const TAIL = 6
    const r = rng(3)
    const drops = Array.from({ length: W }, () => ({ y: r() * 20 - 6, v: 0.35 + r() * 0.5 }))
    return sequence(32, 60, (g) => {
      drops.forEach((d, x) => {
        for (let k = 0; k < TAIL; k++) g.set(x, Math.floor(d.y) - k, k === 0 ? [200, 255, 200] : scale(c, 1 - k / TAIL))
        d.y += d.v
        if (d.y - TAIL > H) d.y = -r() * 10
      })
    })
  },
})

export const plasma = definePreset({
  id: 'plasma',
  name: { tr: 'Plazma', en: 'Plasma' },
  tags: ['ambient', 'party'],
  make: () =>
    sequence(30, 70, (g, i) => {
      const t = (i / 30) * Math.PI * 2
      g.paint((x, y) => {
        const v = Math.sin(x / 5 + t) + Math.sin(y / 3 + t) + Math.sin((x + y) / 7 + t) + Math.sin(Math.hypot(x - 24, y - 6) / 3 - t)
        return hsv(((v + 4) / 8) * 360, 1, 1)
      })
    }),
})

export const equalizer = definePreset({
  id: 'equalizer',
  name: { tr: 'Ekolayzır', en: 'Equalizer' },
  tags: ['party'],
  make: () => {
    const BARS = 12
    const r = rng(11)
    let levels = Array.from({ length: BARS }, () => 6)
    return sequence(20, 90, (g) => {
      levels = levels.map((v) => Math.max(1, Math.min(12, v + Math.round((r() - 0.5) * 7))))
      levels.forEach((h, b) => {
        // 3 px bar + 1 px boşluk; alttan yeşil, üste doğru kırmızıya
        for (let y = 0; y < h; y++) g.fillRect(b * 4, H - 1 - y, 3, 1, hsv(120 - y * 11, 1, 1))
      })
    })
  },
})

export const stars = definePreset({
  id: 'stars',
  name: { tr: 'Yıldızlar', en: 'Twinkle' },
  tags: ['ambient'],
  color: [255, 255, 255],
  make: (c) => {
    const r = rng(5)
    const field = Array.from({ length: 34 }, () => ({ x: Math.floor(r() * W), y: Math.floor(r() * H), p: r() * Math.PI * 2 }))
    return sequence(24, 80, (g, i) =>
      field.forEach((s) => g.set(s.x, s.y, scale(c, Math.max(0, Math.sin(s.p + (i / 24) * Math.PI * 2)) ** 2))),
    )
  },
})

export const snow = definePreset({
  id: 'snow',
  name: { tr: 'Kar', en: 'Snow' },
  tags: ['ambient'],
  color: [220, 235, 255],
  make: (c) => {
    const r = rng(9)
    const flakes = Array.from({ length: 30 }, () => ({ x: r() * W, y: r() * H, v: 0.25 + r() * 0.35 }))
    return sequence(36, 80, (g, i) => flakes.forEach((s) => g.set(s.x + Math.sin(i / 4 + s.v * 10), (s.y + i * s.v) % H, c)))
  },
})
