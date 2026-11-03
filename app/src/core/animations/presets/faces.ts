/** Yüz, göz ve kalp animasyonları. */
import { H } from '../../media'
import type { RGB } from '../../protocol'
import type { Canvas } from '../canvas'
import { BLACK, mix, scale } from '../color'
import { HEART, HEART_BIG } from '../sprites'
import { sequence, steps, still } from '../timeline'
import { definePreset } from '../types'

export const heart = definePreset({
  id: 'heart',
  name: { tr: 'Atan kalp', en: 'Heartbeat' },
  tags: ['fun'],
  color: [255, 20, 60],
  make: (c) => {
    // "güm-güm" çift vuruş, ardından sönümlenme; ilk üç kare hızlı
    const pulse = [1, 0.55, 1, 0.35, 0.25, 0.2]
    return steps(pulse, (_, i) => (i < 3 ? 120 : 220), (g, k) => {
      g.sprite(HEART_BIG, 17, 0, scale(c, k))
      g.sprite(HEART, 3, 3, scale(c, k * 0.6))
      g.sprite(HEART, 38, 3, scale(c, k * 0.6))
    })
  },
})

export const eyes = definePreset({
  id: 'eyes',
  name: { tr: 'Bakan gözler', en: 'Looking eyes' },
  tags: ['fun', 'ride'],
  color: [0, 200, 255],
  make: (c) => {
    const gaze = [0, 0, -3, -3, -3, 0, 0, 3, 3, 3, 0, 0, 0, 0]
    const BLINK_AT = 12
    return steps(gaze, (_, i) => (i === BLINK_AT ? 120 : 160), (g, dx, i) => {
      const blink = i === BLINK_AT
      for (const cx of [13, 34])
        for (let y = 0; y < H; y++)
          for (let x = -8; x <= 8; x++) {
            const inside = (x / 8.5) ** 2 + ((y - 5.5) / 6) ** 2 <= 1
            if (!inside) continue
            if (blink && Math.abs(y - 6) > 0) continue // kırpışta yalnızca orta çizgi kalır
            const pupil = Math.abs(x - dx) <= 2 && Math.abs(y - 6) <= 2
            g.set(cx + x, y, pupil ? BLACK : blink ? c : scale(c, 0.9))
          }
    })
  },
})

// ---------------------------------------------------------------- ejderha bakışı
// Beyazı olmayan, tamamı iris bir göz; dikey yarık göz bebeği sevimliyken yuvarlak büyür, şüphelenince
// incecik yarığa döner ve üst kapak iç köşeye doğru iner. Dış köşeler hafif yukarı çekik.

/** Gözün bir anı (bir kare). */
interface DragonPose {
  ms: number
  /** Göz bebeği yarı genişliği (px): 0 = 1 px yarık, 1 = normal, 3+ = kocaman ve yuvarlak (parıltı çıkar). */
  pupil: number
  /** Bakış yönü (px, + = sağ). */
  gaze: number
  /** Üst kapağın inişi: 0 = tam açık, 1 = kapalı. */
  lid: number
  /** Kaş çatma (0..1): kapak iç köşeye doğru fazladan iner. */
  frown: number
}

const CALM: Omit<DragonPose, 'ms'> = { pupil: 1, gaze: 0, lid: 0.12, frown: 0 }
const SUSPICIOUS: Omit<DragonPose, 'ms'> = { pupil: 0, gaze: 0, lid: 0.36, frown: 1 }

const DRAGON_TIMELINE: DragonPose[] = (
  [
    // sakin bakış, sonra sola ve sağa
    { ms: 700 },
    { ms: 140, gaze: -2 }, { ms: 600, gaze: -4 }, { ms: 140, gaze: -2 },
    { ms: 140, gaze: 2 }, { ms: 600, gaze: 4 }, { ms: 140, gaze: 2 },
    { ms: 300 },
    // göz kırpma
    { ms: 90, pupil: 0.5, lid: 0.5 }, { ms: 90, pupil: 0.5, lid: 1 }, { ms: 110, pupil: 0.5, lid: 0.5 },
    // sevimli: bebek büyüyüp yuvarlaklaşır
    { ms: 120, pupil: 1.6, lid: 0.05 }, { ms: 120, pupil: 2.4, lid: 0 }, { ms: 1400, pupil: 3.2, lid: 0 },
    // tekrar kırp (açılırken bebek hâlâ iri)
    { ms: 90, pupil: 0.5, lid: 0.5 }, { ms: 90, pupil: 0.5, lid: 1 }, { ms: 110, pupil: 2.4, lid: 0.4 },
    // şüpheli: incecik yarık, kısık ve çatık; bu hâlde sağa sola bakar
    { ms: 100, pupil: 1.4, lid: 0.2, frown: 0.5 }, { ms: 100, ...SUSPICIOUS, lid: 0.3 }, { ms: 1300, ...SUSPICIOUS },
    { ms: 500, ...SUSPICIOUS, gaze: -3 }, { ms: 500, ...SUSPICIOUS, gaze: 3 }, { ms: 300, ...SUSPICIOUS, lid: 0.3 },
    { ms: 300 },
  ] as (Partial<DragonPose> & { ms: number })[]
).map((p) => ({ ...CALM, ...p }))

/** Göz geometrisi (px). Badem: üst/alt kapak eğrisi uçlara doğru sivrilir. */
const EYE = { halfWidth: 10, cy: 6.5, up: 5.6, down: 4.6, tilt: 0.2, pupilHalfHeight: 4.2 } as const
/** side: -1 sol göz, +1 sağ göz (dış köşe yönü). */
const DRAGON_EYES = [{ cx: 11.5, side: -1 }, { cx: 36.5, side: 1 }] as const

interface DragonPalette {
  iris: RGB
  /** Bebeğin çevresi (açık sarı-yeşil). */
  glow: RGB
  /** İris kenarı (koyu). */
  rim: RGB
  /** Göz kapağı (koyu antrasit pul rengi). */
  lid: RGB
}

function drawDragonEye(g: Canvas, cx: number, side: number, p: DragonPose, pal: DragonPalette) {
  const { halfWidth: a, cy, up, down, tilt, pupilHalfHeight: ph } = EYE
  for (let x = Math.ceil(cx - a); x <= Math.floor(cx + a); x++) {
    const u = (x - cx) / a
    const s = Math.max(0, 1 - u * u) ** 0.65 // uçları sivri badem
    const out = (x - cx) * side // dış köşeye doğru pozitif
    const yc = cy - tilt * out // dış köşe yukarı çekik
    const top = yc - up * s
    const bot = yc + down * s
    const inner = (1 - out / a) / 2 // dış köşe 0, iç köşe 1
    const lidY = top + (bot - top) * Math.min(1, p.lid + p.frown * 0.3 * inner)
    for (let y = 0; y < H; y++) {
      const yy = y + 0.5 // piksel merkezi
      if (yy < top || yy > bot) continue
      if (yy < lidY) {
        g.set(x, y, pal.lid)
        continue
      }
      const ex = x + 0.5 - (cx + p.gaze)
      const ey = yy - (cy + 0.3)
      const half = p.pupil * Math.sqrt(Math.max(0, 1 - (ey / ph) ** 2))
      if (Math.abs(ey) <= ph && Math.abs(ex) <= half + 0.5) {
        // İri bebekte sol üstte parıltı: sevimli bakışın püf noktası
        const shine = p.pupil >= 2.4 && Math.floor(ex) === -2 && Math.floor(ey) === -2
        g.set(x, y, shine ? [235, 255, 220] : BLACK)
        continue
      }
      const edge = Math.abs(u) > 0.86 || yy - top < 1 || bot - yy < 1
      const nearPupil = Math.hypot(ex / 1.3, ey) < p.pupil + 2.6
      g.set(x, y, edge ? pal.rim : nearPupil ? pal.glow : pal.iris)
    }
  }
}

export const dragonEyes = definePreset({
  id: 'dragon-eyes',
  name: { tr: 'Ejderha bakışı', en: 'Dragon gaze' },
  tags: ['fun', 'ride'],
  color: [120, 215, 20],
  make: (c) => {
    const pal: DragonPalette = { iris: c, glow: mix(c, [255, 240, 60], 0.55), rim: scale(c, 0.45), lid: [28, 34, 48] }
    return steps(DRAGON_TIMELINE, (p) => p.ms, (g, p) => {
      for (const e of DRAGON_EYES) drawDragonEye(g, e.cx, e.side, p, pal)
    })
  },
})

// ---------------------------------------------------------------- diğer
export const smile = definePreset({
  id: 'smile',
  name: { tr: 'Gülen yüz', en: 'Smiley' },
  tags: ['fun'],
  color: [255, 210, 0],
  make: (c) => {
    const EYE_OPEN = ['.##.', '####', '.##.']
    const EYE_WINK = ['....', '####']
    const MOUTH = ['#..............#', '.#............#.', '..##........##..', '....########....']
    const face = (wink: boolean) => (g: Canvas) => {
      g.sprite(wink ? EYE_WINK : EYE_OPEN, 15, wink ? 3 : 2, c)
      g.sprite(EYE_OPEN, 29, 2, c)
      g.sprite(MOUTH, 16, 7, c)
    }
    return [still(1600, face(false)), still(250, face(true))]
  },
})

export const hearts = definePreset({
  id: 'hearts',
  name: { tr: 'Uçan kalpler', en: 'Floating hearts' },
  tags: ['fun'],
  color: [255, 40, 120],
  make: (c) =>
    sequence(18, 90, (g, i) => {
      for (let k = 0; k < 6; k++) g.sprite(HEART, k * 8 + 1, ((12 - ((i + k * 3) % 18)) | 0) - 1, scale(c, 0.6 + (k % 3) * 0.2))
    }),
})
