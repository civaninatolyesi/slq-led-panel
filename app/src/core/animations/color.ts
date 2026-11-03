/** Animasyonlarda kullanılan renk yardımcıları. Hepsi saf fonksiyondur. */
import type { RGB } from '../protocol'

export { hsv } from '../text'

export const BLACK: RGB = [0, 0, 0]
export const WHITE: RGB = [255, 255, 255]

const clamp255 = (v: number) => Math.round(Math.max(0, Math.min(255, v)))

/** Parlaklığı k ile çarpar (0 = siyah, 1 = aynı, >1 = daha parlak; 255'te kırpılır). */
export const scale = ([r, g, b]: RGB, k: number): RGB => [clamp255(r * k), clamp255(g * k), clamp255(b * k)]

/** a'dan b'ye doğrusal karışım (k = 0 -> a, k = 1 -> b). */
export const mix = (a: RGB, b: RGB, k: number): RGB => a.map((v, n) => Math.round(v + (b[n] - v) * k)) as RGB

/**
 * Belirleyici sözde rastgele sayı üreteci, [0, 1) döndürür. Math.random() kullanma: aynı animasyon her
 * üretimde aynı GIF'i vermeli, yoksa panel CRC'si değişir ve "aynı veri" kısayolu çalışmaz.
 */
export function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}
