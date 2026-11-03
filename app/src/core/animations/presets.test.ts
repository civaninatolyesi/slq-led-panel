/**
 * Önayar sözleşmesi: CATALOG'a eklenen her animasyon bu kuralları otomatik olarak sağlamalı.
 * Kuralların gerekçesi: docs/animations.md#panel-kuralları
 */
import { describe, expect, it } from 'vitest'
import { H, MAX_FRAMES, W, encodeGif, framesEqual } from '../media'
import type { RGB } from '../protocol'
import { Canvas } from './canvas'
import { PRESETS, PRESET_TAGS, PresetRegistry, definePreset, getPreset, presetFrames, presets } from './index'
import { pushUp, scrollLeft } from './effects'
import { flipX, mirrorRows } from './sprites'
import { sequence, steps, still } from './timeline'

const OTHER: RGB = [10, 200, 90]
const TAG_IDS: readonly string[] = PRESET_TAGS.map((t) => t.id)
/** Panelin tek seferde rahat aldığı GIF boyutu (≈ 90 parça). */
const MAX_GIF_BYTES = 40_000

describe.each(PRESETS.map((p) => [p.id, p] as const))('önayar %s', (_, p) => {
  const frames = p.make(p.color ?? [255, 255, 255])

  it('meta veri eksiksiz', () => {
    expect(p.name.tr.trim()).not.toBe('')
    expect(p.name.en.trim()).not.toBe('')
    expect(p.tags.length).toBeGreaterThan(0)
    for (const t of p.tags) expect(TAG_IDS).toContain(t)
  })

  it(`1..${MAX_FRAMES} kare, her biri 48x12, süre ≥ 20 ms`, () => {
    expect(frames.length).toBeGreaterThan(0)
    expect(frames.length).toBeLessThanOrEqual(MAX_FRAMES)
    for (const f of frames) {
      expect(f.px.length).toBe(W * H * 4)
      expect(f.delay).toBeGreaterThanOrEqual(frames.length > 1 ? 20 : 0)
    }
  })

  it('belirleyici: aynı renk -> aynı kareler', () => {
    expect(framesEqual(p.make(p.color ?? [255, 255, 255]), frames)).toBe(true)
  })

  it('karanlık değil (en az bir kare yanıyor)', () => {
    expect(frames.some((f) => f.px.some((v, i) => i % 4 !== 3 && v > 0))).toBe(true)
  })

  it.runIf(p.color)('renk seçici gerçekten rengi değiştirir', () => {
    expect(framesEqual(p.make(OTHER), frames)).toBe(false)
  })

  it(`geçerli 48x12 GIF, < ${MAX_GIF_BYTES / 1000} KB`, () => {
    const gif = encodeGif(frames)
    expect(String.fromCharCode(...gif.slice(0, 6))).toBe('GIF89a')
    expect(gif[6] | (gif[7] << 8)).toBe(48)
    expect(gif[8] | (gif[9] << 8)).toBe(12)
    expect(gif[gif.length - 1]).toBe(0x3b)
    expect(gif.length).toBeLessThan(MAX_GIF_BYTES)
  })
})

describe('PresetRegistry', () => {
  const dot = definePreset({ id: 'dot', name: { tr: 'Nokta', en: 'Dot' }, tags: ['fun'], make: () => [still(100, (g) => g.set(0, 0, [255, 0, 0]))] })

  it('yinelenen ve geçersiz kimlikleri reddeder', () => {
    expect(() => new PresetRegistry([dot, dot])).toThrow(/iki kez/)
    expect(() => new PresetRegistry([{ ...dot, id: 'Kötü Kimlik' }])).toThrow(/kebab-case/)
  })

  it('kimlikle erişim, etiket filtresi, önbellek', () => {
    expect(getPreset('rainbow').id).toBe('rainbow')
    expect(() => getPreset('yok-boyle-bir-sey')).toThrow(/bilinmeyen/)
    expect(presets.byTag('all')).toHaveLength(PRESETS.length)
    expect(presets.byTag('signal').every((p) => p.tags.includes('signal'))).toBe(true)
    expect(presetFrames('heart')).toBe(presetFrames(getPreset('heart')))
    expect(presetFrames('heart', OTHER)).not.toBe(presetFrames('heart'))
  })
})

describe('çizim temelleri', () => {
  it('Canvas: ekran dışı yazma yok sayılır, okuma siyah döner', () => {
    const g = Canvas.blank()
    g.set(-1, 0, [255, 0, 0])
    g.set(W, H, [255, 0, 0])
    expect(g.get(-1, 0)).toEqual([0, 0, 0])
    g.set(2.4, 3.6, [1, 2, 3]) // yuvarlanır -> (2, 4)
    expect(g.get(2, 4)).toEqual([1, 2, 3])
    expect(g.isLit(2, 4)).toBe(true)
  })

  it('Canvas.sprite: yalnızca dolu karakterler çizilir', () => {
    const g = Canvas.blank()
    g.sprite(['#.', ' #'], 0, 0, [9, 9, 9])
    expect([g.isLit(0, 0), g.isLit(1, 0), g.isLit(0, 1), g.isLit(1, 1)]).toEqual([true, false, false, true])
  })

  it('timeline: sequence/steps/still kare sayısı ve süreleri', () => {
    expect(sequence(5, 70, () => {}).map((f) => f.delay)).toEqual([70, 70, 70, 70, 70])
    expect(steps([10, 20], (ms) => ms, () => {}).map((f) => f.delay)).toEqual([10, 20])
    expect(still(300).delay).toBe(300)
  })

  it('effects: scrollLeft dikişsiz döngü, pushUp ara kare sayısı', () => {
    const fr = scrollLeft((x) => (x === 0 ? [255, 255, 255] : [0, 0, 0]), 12, 50)
    expect(fr).toHaveLength(12)
    expect(Canvas.of(fr[1]).isLit(11, 0)).toBe(true) // 1 kare sonra desen 1 px sola kaydı
    expect(pushUp(still(0), still(0), [3, 6, 9])).toHaveLength(3)
  })

  it('sprites: flipX / mirrorRows', () => {
    expect(flipX(['#..'])).toEqual(['..#'])
    expect(mirrorRows(['a', 'b'])).toEqual(['a', 'b', 'b', 'a'])
  })
})
