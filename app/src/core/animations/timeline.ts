/**
 * Kare dizisi kurucuları. Bir animasyon Frame[] döndürür; bu üç fonksiyon hemen her ihtiyacı karşılar:
 * - sequence: n eşit süreli kare (dönen/kayan/simülasyon efektleri)
 * - steps:    bir değer listesinden kare başına bir kare (poz, parlaklık, konum tabloları)
 * - still:    tek kare (duraklama, bekleme, tek görüntü)
 */
import type { Frame } from '../media'
import { Canvas } from './canvas'

/** draw her kare için sırayla (i = 0..n-1) çağrılır; kareler arası durum (parçacık konumu vb.) taşıyabilir. */
export function sequence(n: number, delay: number, draw: (g: Canvas, i: number) => void): Frame[] {
  return Array.from({ length: n }, (_, i) => {
    const g = Canvas.blank(delay)
    draw(g, i)
    return g.frame
  })
}

/** Siyah zeminde tek kare; draw verilmezse boş (karanlık) kare. */
export function still(delay: number, draw?: (g: Canvas) => void): Frame {
  const g = Canvas.blank(delay)
  draw?.(g)
  return g.frame
}

/** items'ın her öğesi için bir kare. delay sabit ya da öğeye göre (ör. poz tablosundaki ms). */
export function steps<T>(
  items: readonly T[],
  delay: number | ((item: T, i: number) => number),
  draw: (g: Canvas, item: T, i: number) => void,
): Frame[] {
  return items.map((item, i) => still(typeof delay === 'number' ? delay : delay(item, i), (g) => draw(g, item, i)))
}
