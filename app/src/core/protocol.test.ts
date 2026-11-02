/**
 * TypeScript protokol portu, Python referans istemcisiyle (slq/) bayt bayt aynı çıktıyı üretmeli.
 * Vektörler: python tools/gen_test_vectors.py
 */
import { describe, expect, it } from 'vitest'
import { PRESETS } from './animations'
import { encodeGif, type Frame } from './media'
import * as P from './protocol'
import { encodeText, fontStd, glyphToRows, rowsToGlyph } from './text'
import font from './font12.json'
import V from './vectors.json'

const NOW = new Date(2026, 10, 2, 21, 7, 9)
const enc = new TextEncoder()
const noRaster = () => {
  throw new Error('bu testte bitmap glif beklenmiyor')
}

describe('CRC', () => {
  it('CRC-16/MODBUS ve CRC-32C kontrol değerleri', () => {
    expect(P.hex(P.crc16(enc.encode('123456789'))).replace(/ /g, '')).toBe(V.crc16_123456789)
    expect(P.hex(P.crc32c(enc.encode('123456789'))).replace(/ /g, '')).toBe(V.crc32c_123456789)
  })
})

describe('komut çerçeveleri Python ile aynı', () => {
  const text = encodeText('HELLO12', [255, 128, 0], 'narrow', noRaster).data
  const gif = new Uint8Array(1024).map((_, i) => i & 0xff)
  const ours: Record<keyof typeof V.frames, Uint8Array> = {
    query_info: P.queryInfo(),
    brightness_10: P.brightness(10),
    brightness_0: P.brightness(0),
    power_on: P.power(true),
    power_off: P.power(false),
    rotate_on: P.rotate180(true),
    text_style: P.textStyle({ effect: P.Effect.LEFT, speed: 60, colorIndex: 3, rgb: [255, 0, 0], bgIndex: 0, bgRgb: [0, 0, 64], orientation: 1 }),
    graffiti_new: P.graffiti(P.GraffitiMode.NEW),
    pixel: P.pixel(47, 11, [1, 2, 3], P.PixelMode.MIRROR_H),
    rhythm: P.rhythm(2, [...Array(12).keys()]),
    rhythm_off: P.rhythmOff(),
    bike_signal_right: P.bikeSignal(P.BikeSignal.RIGHT),
    bike_speed_25_5: P.bikeSpeed(25.5),
    bike_speed_mph: P.bikeSpeed(12.3, true),
    playlist_begin_3: P.playlistBegin(3),
    playlist_clear: P.playlistClear(),
    clock_2: P.clock(2, NOW, 1, 0),
    schedule_off: P.schedule(null, [23, 30], NOW),
    schedule_both: P.schedule([7, 5], [23, 30], NOW),
    schedule_none: P.schedule(null, null, NOW),
    reset: P.reset(),
    sync: P.sync(),
    transfer_done: P.transferDone(),
    text_start: P.textStart(text, { index: 2, effect: P.Effect.LASER, speed: 55, colorIndex: 3, bgRgb: [1, 2, 3], orientation: 1 }),
    image_start: P.imageStart(gif, 4),
  }
  for (const [name, frame] of Object.entries(ours)) {
    it(name, () => expect(P.hex(frame).replace(/ /g, '')).toBe(V.frames[name as keyof typeof V.frames]))
  }

  it('parçalama (C822)', () => {
    expect(P.chunks(P.IMAGE_CHUNK_HEADER, gif).map((c) => P.hex(c).replace(/ /g, ''))).toEqual(V.chunks_image_1024)
  })
})

describe('metin kodlama', () => {
  it('font dönüşümü (convertToStandardFormat) tüm glifler için aynı', () => {
    for (const [ch, raw] of Object.entries(font as Record<string, number[]>))
      expect(P.hex(fontStd(raw)).replace(/ /g, ''), ch).toBe((V.font_std as Record<string, string>)[ch])
  })

  it('"HELLO12" karışık mod Python ile aynı', () => {
    expect(P.hex(encodeText('HELLO12', [255, 128, 0], 'narrow', noRaster).data).replace(/ /g, '')).toBe(V.text_HELLO12_mixed)
  })

  it('Türkçe harfler dar (TİP 3) glif olarak üretilir', () => {
    const r = encodeText('ÇŞĞÜÖİçşğüöı ', [255, 0, 0], 'narrow', noRaster)
    expect(r.glyphs.every((g) => g.width === 6)).toBe(true)
    expect(r.data.length).toBe(13 * 16)
    // İ = I + üstte nokta; ı = i - nokta
    const I = glyphToRows(fontStd((font as Record<string, number[]>).I), 6)
    expect(r.glyphs[5].rows[0][2]).toBe(true)
    expect(r.glyphs[5].rows.slice(1)).toEqual(I.slice(1))
    expect(r.glyphs[11].rows[2][2]).toBe(false)
  })

  it('glif satır/bayt dönüşümü tersinir', () => {
    const g = fontStd((font as Record<string, number[]>).A)
    expect(rowsToGlyph(glyphToRows(g, 6), 6)).toEqual(g)
  })
})

describe('GIF', () => {
  it('tüm hazır animasyonlar geçerli 48x12 GIF üretir', () => {
    for (const p of PRESETS) {
      const frames: Frame[] = p.make(p.color ?? [255, 255, 255])
      const gif = encodeGif(frames)
      expect(String.fromCharCode(...gif.slice(0, 6)), p.id).toBe('GIF89a')
      expect(gif[6] | (gif[7] << 8)).toBe(48)
      expect(gif[8] | (gif[9] << 8)).toBe(12)
      expect(gif[gif.length - 1]).toBe(0x3b)
      expect(gif.length, p.id).toBeLessThan(40_000)
    }
  })
})
