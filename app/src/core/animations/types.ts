import type { Frame } from '../media'
import type { RGB } from '../protocol'

export interface Localized {
  tr: string
  en: string
}

/** Galeri filtreleri. Yeni etiket eklersen arayüz filtresi otomatik gelir. */
export const PRESET_TAGS = [
  { id: 'fun', name: { tr: 'Eğlence', en: 'Fun' } },
  { id: 'ride', name: { tr: 'Sürüş', en: 'Ride' } },
  { id: 'party', name: { tr: 'Parti', en: 'Party' } },
  { id: 'ambient', name: { tr: 'Ortam', en: 'Ambient' } },
  { id: 'signal', name: { tr: 'Sinyal', en: 'Signal' } },
] as const satisfies readonly { id: string; name: Localized }[]

export type PresetTag = (typeof PRESET_TAGS)[number]['id']

/** Uygulamaya gömülü, kodla üretilen bir animasyon. */
export interface Preset {
  /** Kalıcı kimlik (kebab-case). Değiştirme: kullanıcı ayarları ve önbellek buna bağlı. */
  readonly id: string
  readonly name: Localized
  readonly tags: readonly PresetTag[]
  /** Varsa arayüzde renk seçici çıkar ve make bu rengi alır. Yoksa animasyon kendi renklerini kullanır. */
  readonly color?: RGB
  /** Kareleri üretir. Saf ve belirleyici olmalı: aynı renk -> bit bit aynı kareler. */
  make(color: RGB): Frame[]
}

/** Tip denetimli önayar tanımı (kimlik fonksiyonu; doğrulama kayıt sırasında PresetRegistry'de yapılır). */
export const definePreset = (p: Preset): Preset => p
