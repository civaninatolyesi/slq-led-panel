/** Sürüş ve sinyal animasyonları (sinyal okları, fren, çakar, tarayıcı). */
import { H, W } from '../../media'
import type { RGB } from '../../protocol'
import type { Canvas } from '../canvas'
import { scale } from '../color'
import { CHEVRON, flipX } from '../sprites'
import { sequence, steps, still } from '../timeline'
import { definePreset } from '../types'

/** Ok sırası: 9 px aralıklı, 2 px kalın ok başları; her karede 2 px kayar. */
const ARROW_SPACING = 9
const ARROW_LOOP = 54 // ok konumlarının sarıldığı genişlik (6 ok x 9 px)

export const left = definePreset({
  id: 'left',
  name: { tr: 'Sola dön', en: 'Turn left' },
  tags: ['ride', 'signal'],
  color: [255, 140, 0],
  make: (c) => {
    const arrow = flipX(CHEVRON)
    return sequence(8, 70, (g, i) => {
      for (let k = -1; k < 6; k++) {
        const x = 44 - ((i * 2 + k * ARROW_SPACING) % ARROW_LOOP)
        g.sprite(arrow, x, 2, c)
        g.sprite(arrow, x + 1, 2, c)
      }
    })
  },
})

export const right = definePreset({
  id: 'right',
  name: { tr: 'Sağa dön', en: 'Turn right' },
  tags: ['ride', 'signal'],
  color: [255, 140, 0],
  make: (c) =>
    sequence(8, 70, (g, i) => {
      for (let k = -1; k < 6; k++) {
        const x = ((i * 2 + k * ARROW_SPACING) % ARROW_LOOP) - 6
        g.sprite(CHEVRON, x, 2, c)
        g.sprite(CHEVRON, x + 1, 2, c)
      }
    }),
})

export const brake = definePreset({
  id: 'brake',
  name: { tr: 'Fren lambası', en: 'Brake light' },
  tags: ['ride', 'signal'],
  color: [255, 0, 0],
  // iki hızlı çakma, ardından sabit yanma ve kısa sönme
  make: (c) => steps([1, 0.15, 1, 0.15, 1, 1, 1, 0.5], 110, (g, k) => g.fill(scale(c, k))),
})

export const hazard = definePreset({
  id: 'hazard',
  name: { tr: 'Dikkat şeridi', en: 'Hazard stripes' },
  tags: ['ride', 'signal'],
  color: [255, 190, 0],
  make: (c) => sequence(12, 60, (g, i) => g.paint((x, y) => ((((x + y + i) % 12) + 12) % 12 < 6 ? c : null))),
})

export const police = definePreset({
  id: 'police',
  name: { tr: 'Çakar', en: 'Strobe' },
  tags: ['party', 'signal'],
  make: () => {
    const half = (side: 'left' | 'right', c: RGB) => (g: Canvas) => g.fillRect(side === 'left' ? 0 : W / 2, 0, W / 2, H, c)
    // çift çakma + kısa karanlık
    const doubleFlash = (draw: (g: Canvas) => void) => [still(60, draw), still(60), still(60, draw), still(90)]
    return [...doubleFlash(half('left', [255, 0, 0])), ...doubleFlash(half('right', [0, 40, 255]))]
  },
})

export const scanner = definePreset({
  id: 'scanner',
  name: { tr: 'Tarayıcı ışık', en: 'Scanner' },
  tags: ['ride', 'ambient'],
  color: [255, 0, 0],
  make: (c) => {
    const forward = [...Array(22).keys()].map((i) => i * 2)
    const path = [...forward, ...forward.map((p) => 44 - p)] // ileri, geri
    return steps(path, 40, (g, p) => {
      for (let x = 0; x < W; x++) {
        const k = Math.max(0, 1 - Math.abs(x - p - 2) / 7) // 7 px kuyruk
        if (k > 0) for (let y = 2; y < 10; y++) g.set(x, y, scale(c, k * k))
      }
    })
  },
})
