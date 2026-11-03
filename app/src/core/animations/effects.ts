/** Durağan bir görüntüyü hareketlendiren yeniden kullanılabilir efektler. */
import { H, W, type Frame } from '../media'
import type { RGB } from '../protocol'
import { Canvas } from './canvas'
import { BLACK, scale } from './color'
import { sequence, steps } from './timeline'

export interface WaveOptions {
  /** Dalga boyu (px). */
  wavelength?: number
  /** Sütunlar ±1 px kayar. Küçük şekilleri bozduğu için yalnızca büyük görüntüde, uzun dalga boyuyla kullan. */
  lift?: boolean
}

/**
 * Görüntüyü bayrak gibi dalgalandırır. along(x): sütunun gönderden uzaklığı (null = sabit sütun).
 * Dalga gönderden dışa doğru ilerler ve eğime göre gölgelenir. n kare tam bir dalga periyodudur (kesintisiz döngü).
 */
export function wave(
  src: Frame,
  n: number,
  delay: number,
  along: (x: number) => number | null,
  { wavelength = 40, lift = true }: WaveOptions = {},
): Frame[] {
  const s = Canvas.of(src)
  return sequence(n, delay, (g, i) => {
    for (let x = 0; x < W; x++) {
      const d = along(x)
      if (d === null) {
        for (let y = 0; y < H; y++) g.set(x, y, s.get(x, y))
        continue
      }
      const ph = 2 * Math.PI * (d / wavelength - i / n)
      const dy = lift ? Math.round(Math.min(1, d / 8) * Math.sin(ph)) : 0
      const k = Math.round((lift ? 0.82 + 0.18 * Math.cos(ph) : 0.78 + 0.22 * Math.cos(ph)) * 10) / 10
      for (let y = 0; y < H; y++) {
        const sy = y - dy
        g.set(x, y, sy < 0 || sy >= H ? BLACK : scale(s.get(x, sy), k))
      }
    }
  })
}

/** Dikey itme geçişi: from yukarı kayarken to alttan gelir. offsets: her ara karede kayma miktarı (px). */
export function pushUp(from: Frame, to: Frame, offsets: readonly number[] = [1, 2, 4, 6, 8, 10, 11], delay = 45): Frame[] {
  const a = Canvas.of(from)
  const b = Canvas.of(to)
  return steps(offsets, delay, (g, s) => g.paint((x, y) => (y + s < H ? a.get(x, y + s) : b.get(x, y - H + s))))
}

/**
 * period sütun genişliğindeki deseni sola doğru sonsuz kaydırır. Tam bir tur period kare sürer,
 * böylece döngü dikişsizdir. sample(x, y): x ∈ [0, period) için desen rengi.
 */
export function scrollLeft(sample: (x: number, y: number) => RGB, period: number, delay: number): Frame[] {
  return sequence(period, delay, (g, i) => g.paint((x, y) => sample((x + i) % period, y)))
}
