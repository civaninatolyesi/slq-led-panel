import type { Frame } from '../media'
import type { RGB } from '../protocol'
import { WHITE } from './color'
import type { Preset, PresetTag } from './types'

const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

/**
 * Önayar kataloğu: sıralı liste, kimlikle erişim, etikete göre filtre ve önbellekli kare üretimi.
 * Arayüz önayarları yalnızca bu sınıf üzerinden kullanır; yeni önayar eklemek arayüzde değişiklik gerektirmez.
 */
export class PresetRegistry {
  private readonly byId = new Map<string, Preset>()
  private readonly cache = new Map<string, Frame[]>()

  constructor(presets: readonly Preset[]) {
    for (const p of presets) {
      if (!ID_PATTERN.test(p.id)) throw new Error(`geçersiz önayar kimliği "${p.id}" (kebab-case olmalı)`)
      if (this.byId.has(p.id)) throw new Error(`önayar kimliği iki kez kullanılmış: "${p.id}"`)
      this.byId.set(p.id, p)
    }
  }

  /** Galeri sırasıyla tüm önayarlar. */
  get all(): readonly Preset[] {
    return [...this.byId.values()]
  }

  find(id: string): Preset | undefined {
    return this.byId.get(id)
  }

  get(id: string): Preset {
    const p = this.byId.get(id)
    if (!p) throw new Error(`bilinmeyen önayar: "${id}"`)
    return p
  }

  byTag(tag: PresetTag | 'all'): Preset[] {
    return this.all.filter((p) => tag === 'all' || p.tags.includes(tag))
  }

  /** Önbellekli üretim: aynı önayar + renk tekrar hesaplanmaz. Dönen kareler değiştirilmemeli (gerekirse cloneFrames). */
  frames(preset: Preset | string, color?: RGB): Frame[] {
    const p = typeof preset === 'string' ? this.get(preset) : preset
    const c = color ?? p.color ?? WHITE
    const key = `${p.id}|${c.join()}`
    let frames = this.cache.get(key)
    if (!frames) {
      frames = p.make(c)
      this.cache.set(key, frames)
    }
    return frames
  }
}
