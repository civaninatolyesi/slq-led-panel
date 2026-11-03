/**
 * Uygulamaya gömülü hazır animasyonlar. Hepsi kodla üretilir (telifli içerik yok) ve 48x12 GIF olarak gönderilir.
 * Yeni animasyon ekleme rehberi: docs/animations.md
 *
 * Katmanlar (alttan üste):
 *   color, canvas, sprites  -> çizim temelleri
 *   timeline, effects       -> kare dizisi kurucuları ve yeniden kullanılabilir hareketler
 *   presets/*               -> tek tek animasyonlar (temaya göre dosyalar)
 *   registry + CATALOG      -> galeri sırası, kimlikle erişim, önbellek
 */
import { makeFrame, type Frame } from '../media'
import type { RGB } from '../protocol'
import { equalizer, fire, matrix, plasma, rainbow, snow, stars } from './presets/classic'
import { dragonEyes, eyes, heart, hearts, smile } from './presets/faces'
import { brake, hazard, left, police, right, scanner } from './presets/signals'
import {
  ayyildizShine,
  kilim,
  turkflag,
  turkflagDuo,
  turkflagFireworks,
  turkflagScroll,
  turkflagWave,
  turkiye,
} from './presets/turkish'
import { PresetRegistry } from './registry'
import type { Preset } from './types'

export { PRESET_TAGS, definePreset, type Localized, type Preset, type PresetTag } from './types'
export { PresetRegistry } from './registry'

/** Galeri sırası. Yeni animasyonu buraya ekle; arayüz başka değişiklik gerektirmez. */
const CATALOG: readonly Preset[] = [
  rainbow,
  fire,
  matrix,
  heart,
  eyes,
  dragonEyes,
  smile,
  left,
  right,
  brake,
  hazard,
  police,
  scanner,
  plasma,
  equalizer,
  stars,
  snow,
  hearts,
  turkflag,
  turkflagWave,
  turkflagScroll,
  turkflagDuo,
  ayyildizShine,
  turkiye,
  turkflagFireworks,
  kilim,
]

export const presets = new PresetRegistry(CATALOG)

/** Galeri sırasıyla tüm önayarlar. */
export const PRESETS: readonly Preset[] = presets.all

/** Kimlikle önayar; bilinmeyen kimlikte hata fırlatır. */
export const getPreset = (id: string): Preset => presets.get(id)

/** Önbellekli kare üretimi. Dönen kareler değiştirilmemeli (düzenlemek için cloneFrames). */
export const presetFrames = (p: Preset | string, color?: RGB): Frame[] => presets.frames(p, color)

export function solidColor(c: RGB): Frame[] {
  return [makeFrame(100, c)]
}
