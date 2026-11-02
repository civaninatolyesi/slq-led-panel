/**
 * Uygulamaya gömülü hazır animasyonlar. Hepsi kodla üretilir (telifli içerik yok) ve 48x12 GIF olarak gönderilir.
 */
import { H, W, makeFrame, setPx, type Frame } from './media'
import type { RGB } from './protocol'
import { hsv } from './text'

export interface Preset {
  id: string
  name: { tr: string; en: string }
  tags: ('fun' | 'ride' | 'party' | 'ambient' | 'signal')[]
  /** Kullanıcı rengi alanlar için varsayılan renk. */
  color?: RGB
  make: (color: RGB) => Frame[]
}

const seq = (n: number, delay: number, draw: (f: Frame, i: number) => void): Frame[] =>
  Array.from({ length: n }, (_, i) => {
    const f = makeFrame(delay)
    draw(f, i)
    return f
  })

/** Belirleyici sözde rastgele (her üretimde aynı GIF -> panelde CRC aynı kalır). */
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

const scale = ([r, g, b]: RGB, k: number): RGB => [r * k, g * k, b * k].map((v) => Math.round(Math.max(0, Math.min(255, v)))) as RGB

// 5 sütunlu küçük ikon çizimleri: '#' = renk
function sprite(f: Frame, rows: string[], ox: number, oy: number, color: RGB | ((ch: string) => RGB | null)) {
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === '.' || ch === ' ') return
      const c = typeof color === 'function' ? color(ch) : color
      if (c) setPx(f.px, ox + x, oy + y, c)
    }),
  )
}

const HEART = [
  '.##.##.',
  '#######',
  '#######',
  '.#####.',
  '..###..',
  '...#...',
]
const HEART_BIG = [
  '..###...###..',
  '.#####.#####.',
  '#############',
  '#############',
  '#############',
  '.###########.',
  '..#########..',
  '...#######...',
  '....#####....',
  '.....###.....',
  '......#......',
]
const CHEVRON = ['#...', '.#..', '..#.', '...#', '..#.', '.#..', '#...']

export const PRESETS: Preset[] = [
  {
    id: 'rainbow',
    name: { tr: 'Gökkuşağı dalgası', en: 'Rainbow wave' },
    tags: ['party', 'ambient'],
    make: () =>
      seq(24, 70, (f, i) => {
        for (let x = 0; x < W; x++)
          for (let y = 0; y < H; y++) setPx(f.px, x, y, hsv((x * 7.5 + y * 6 + i * 15) % 360, 1, 1))
      }),
  },
  {
    id: 'fire',
    name: { tr: 'Alev', en: 'Fire' },
    tags: ['fun', 'party'],
    make: () => {
      const r = rng(7)
      const heat = Array.from({ length: H + 1 }, () => new Float32Array(W))
      const out: Frame[] = []
      for (let i = 0; i < 40; i++) {
        for (let x = 0; x < W; x++) heat[H][x] = r() > 0.35 ? 1 : 0.2 + r() * 0.3
        for (let y = 0; y < H; y++)
          for (let x = 0; x < W; x++) {
            const a = heat[y + 1][(x + W - 1) % W] + heat[y + 1][x] * 2 + heat[y + 1][(x + 1) % W]
            heat[y][x] = Math.max(0, a / 4 - 0.055 - r() * 0.04)
          }
        if (i < 16) continue
        out.push(
          seq(1, 70, (f) => {
            for (let y = 0; y < H; y++)
              for (let x = 0; x < W; x++) {
                const t = heat[y][x]
                setPx(f.px, x, y, [Math.min(255, t * 420), Math.min(255, t * t * 300), Math.min(255, t ** 4 * 160)])
              }
          })[0],
        )
      }
      return out
    },
  },
  {
    id: 'matrix',
    name: { tr: 'Dijital yağmur', en: 'Digital rain' },
    tags: ['ambient'],
    color: [0, 255, 70],
    make: (c) => {
      const r = rng(3)
      const drops = Array.from({ length: W }, () => ({ y: r() * 20 - 6, v: 0.35 + r() * 0.5 }))
      return seq(32, 60, (f) => {
        drops.forEach((d, x) => {
          for (let k = 0; k < 6; k++) setPx(f.px, x, Math.floor(d.y) - k, k === 0 ? [200, 255, 200] : scale(c, 1 - k / 6))
          d.y += d.v
          if (d.y - 6 > H) d.y = -r() * 10
        })
      })
    },
  },
  {
    id: 'heart',
    name: { tr: 'Atan kalp', en: 'Heartbeat' },
    tags: ['fun'],
    color: [255, 20, 60],
    make: (c) =>
      [1, 0.55, 1, 0.35, 0.25, 0.2].map((k, i) =>
        seq(1, i < 3 ? 120 : 220, (f) => {
          sprite(f, HEART_BIG, 17, 0, scale(c, k))
          sprite(f, HEART, 3, 3, scale(c, k * 0.6))
          sprite(f, HEART, 38, 3, scale(c, k * 0.6))
        })[0],
      ),
  },
  {
    id: 'eyes',
    name: { tr: 'Bakan gözler', en: 'Looking eyes' },
    tags: ['fun', 'ride'],
    color: [0, 200, 255],
    make: (c) => {
      const look = [0, 0, -3, -3, -3, 0, 0, 3, 3, 3, 0, 0, 0, 0]
      return look.flatMap((dx, i) => {
        const blink = i === 12
        return seq(1, blink ? 120 : 160, (f) => {
          for (const cx of [13, 34]) {
            for (let y = 0; y < H; y++)
              for (let x = -8; x <= 8; x++) {
                const inside = (x / 8.5) ** 2 + ((y - 5.5) / 6) ** 2 <= 1
                if (!inside) continue
                if (blink && Math.abs(y - 6) > 0) continue
                const pupil = Math.abs(x - dx) <= 2 && Math.abs(y - 6) <= 2
                setPx(f.px, cx + x, y, pupil ? [0, 0, 0] : blink ? c : scale(c, 0.9))
              }
          }
        })
      })
    },
  },
  {
    id: 'smile',
    name: { tr: 'Gülen yüz', en: 'Smiley' },
    tags: ['fun'],
    color: [255, 210, 0],
    make: (c) => {
      const face = (wink: boolean) => (f: Frame) => {
        sprite(f, wink ? ['....', '####'] : ['.##.', '####', '.##.'], 15, wink ? 3 : 2, c)
        sprite(f, ['.##.', '####', '.##.'], 29, 2, c)
        sprite(f, ['#..............#', '.#............#.', '..##........##..', '....########....'], 16, 7, c)
      }
      return [...seq(1, 1600, face(false)), ...seq(1, 250, face(true))]
    },
  },
  {
    id: 'left',
    name: { tr: 'Sola dön', en: 'Turn left' },
    tags: ['ride', 'signal'],
    color: [255, 140, 0],
    make: (c) =>
      seq(8, 70, (f, i) => {
        for (let k = -1; k < 6; k++) {
          const x = 44 - ((i * 2 + k * 9) % 54)
          sprite(f, CHEVRON.map((r) => [...r].reverse().join('')), x, 2, c)
          sprite(f, CHEVRON.map((r) => [...r].reverse().join('')), x + 1, 2, c)
        }
      }),
  },
  {
    id: 'right',
    name: { tr: 'Sağa dön', en: 'Turn right' },
    tags: ['ride', 'signal'],
    color: [255, 140, 0],
    make: (c) =>
      seq(8, 70, (f, i) => {
        for (let k = -1; k < 6; k++) {
          const x = ((i * 2 + k * 9) % 54) - 6
          sprite(f, CHEVRON, x, 2, c)
          sprite(f, CHEVRON, x + 1, 2, c)
        }
      }),
  },
  {
    id: 'brake',
    name: { tr: 'Fren lambası', en: 'Brake light' },
    tags: ['ride', 'signal'],
    color: [255, 0, 0],
    make: (c) =>
      [1, 0.15, 1, 0.15, 1, 1, 1, 0.5].map((k) =>
        seq(1, 110, (f) => {
          for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) setPx(f.px, x, y, scale(c, k))
        })[0],
      ),
  },
  {
    id: 'hazard',
    name: { tr: 'Dikkat şeridi', en: 'Hazard stripes' },
    tags: ['ride', 'signal'],
    color: [255, 190, 0],
    make: (c) =>
      seq(12, 60, (f, i) => {
        for (let x = 0; x < W; x++)
          for (let y = 0; y < H; y++) if ((((x + y + i) % 12) + 12) % 12 < 6) setPx(f.px, x, y, c)
      }),
  },
  {
    id: 'police',
    name: { tr: 'Çakar', en: 'Strobe' },
    tags: ['party', 'signal'],
    make: () => {
      const half = (f: Frame, left: boolean, c: RGB) => {
        for (let x = left ? 0 : 24; x < (left ? 24 : 48); x++) for (let y = 0; y < H; y++) setPx(f.px, x, y, c)
      }
      const R: RGB = [255, 0, 0]
      const B: RGB = [0, 40, 255]
      return [
        ...seq(1, 60, (f) => half(f, true, R)), ...seq(1, 60, () => {}), ...seq(1, 60, (f) => half(f, true, R)),
        ...seq(1, 90, () => {}),
        ...seq(1, 60, (f) => half(f, false, B)), ...seq(1, 60, () => {}), ...seq(1, 60, (f) => half(f, false, B)),
        ...seq(1, 90, () => {}),
      ]
    },
  },
  {
    id: 'scanner',
    name: { tr: 'Tarayıcı ışık', en: 'Scanner' },
    tags: ['ride', 'ambient'],
    color: [255, 0, 0],
    make: (c) => {
      const pos = [...Array(22).keys()].map((i) => i * 2).concat([...Array(22).keys()].map((i) => 44 - i * 2))
      return pos.map((p) =>
        seq(1, 40, (f) => {
          for (let x = 0; x < W; x++) {
            const k = Math.max(0, 1 - Math.abs(x - p - 2) / 7)
            if (k > 0) for (let y = 2; y < 10; y++) setPx(f.px, x, y, scale(c, k * k))
          }
        })[0],
      )
    },
  },
  {
    id: 'plasma',
    name: { tr: 'Plazma', en: 'Plasma' },
    tags: ['ambient', 'party'],
    make: () =>
      seq(30, 70, (f, i) => {
        const t = (i / 30) * Math.PI * 2
        for (let x = 0; x < W; x++)
          for (let y = 0; y < H; y++) {
            const v = Math.sin(x / 5 + t) + Math.sin(y / 3 + t) + Math.sin((x + y) / 7 + t) + Math.sin(Math.hypot(x - 24, y - 6) / 3 - t)
            setPx(f.px, x, y, hsv(((v + 4) / 8) * 360, 1, 1))
          }
      }),
  },
  {
    id: 'equalizer',
    name: { tr: 'Ekolayzır', en: 'Equalizer' },
    tags: ['party'],
    make: () => {
      const r = rng(11)
      let lv = Array.from({ length: 12 }, () => 6)
      return seq(20, 90, (f) => {
        lv = lv.map((v) => Math.max(1, Math.min(12, v + Math.round((r() - 0.5) * 7))))
        lv.forEach((h, b) => {
          for (let y = 0; y < h; y++) for (let x = b * 4; x < b * 4 + 3; x++) setPx(f.px, x, H - 1 - y, hsv(120 - y * 11, 1, 1))
        })
      })
    },
  },
  {
    id: 'stars',
    name: { tr: 'Yıldızlar', en: 'Twinkle' },
    tags: ['ambient'],
    color: [255, 255, 255],
    make: (c) => {
      const r = rng(5)
      const stars = Array.from({ length: 34 }, () => ({ x: Math.floor(r() * W), y: Math.floor(r() * H), p: r() * Math.PI * 2 }))
      return seq(24, 80, (f, i) =>
        stars.forEach((s) => setPx(f.px, s.x, s.y, scale(c, Math.max(0, Math.sin(s.p + (i / 24) * Math.PI * 2)) ** 2))),
      )
    },
  },
  {
    id: 'snow',
    name: { tr: 'Kar', en: 'Snow' },
    tags: ['ambient'],
    color: [220, 235, 255],
    make: (c) => {
      const r = rng(9)
      const flakes = Array.from({ length: 30 }, () => ({ x: r() * W, y: r() * H, v: 0.25 + r() * 0.35 }))
      return seq(36, 80, (f, i) =>
        flakes.forEach((s) => setPx(f.px, s.x + Math.sin(i / 4 + s.v * 10), ((s.y + i * s.v * 1.0) % H), c)),
      )
    },
  },
  {
    id: 'hearts',
    name: { tr: 'Uçan kalpler', en: 'Floating hearts' },
    tags: ['fun'],
    color: [255, 40, 120],
    make: (c) =>
      seq(18, 90, (f, i) => {
        for (let k = 0; k < 6; k++) sprite(f, HEART, k * 8 + 1, ((12 - ((i + k * 3) % 18)) | 0) - 1, scale(c, 0.6 + (k % 3) * 0.2))
      }),
  },
]

const cache = new Map<string, Frame[]>()

/** Önbellekli üretim: aynı animasyon + renk tekrar hesaplanmaz. Dönen kareler değiştirilmemeli. */
export function presetFrames(p: Preset, color?: RGB): Frame[] {
  const c = color ?? p.color ?? [255, 255, 255]
  const key = `${p.id}|${c.join()}`
  if (!cache.has(key)) cache.set(key, p.make(c))
  return cache.get(key)!
}

export function solidColor(c: RGB): Frame[] {
  return [makeFrame(100, c)]
}
