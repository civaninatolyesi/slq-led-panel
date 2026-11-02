/**
 * SLQ panel BLE protokolü — slq/protocol.py'nin TypeScript karşılığı.
 * Spesifikasyon: docs/protocol/. Her kurucu, docs/protocol/03-commands.md'deki bir satıra karşılık gelir.
 */

const u16 = (x: number) => `0000${x.toString(16).padStart(4, '0')}-0000-1000-8000-00805f9b34fb`

export const SERVICE_UUID = u16(0xc820)
export const CMD_CHAR = u16(0xc821) // komutlar (CRC16 ekli çerçeve)
export const DATA_CHAR = u16(0xc822) // toplu veri parçaları
export const NOTIFY_CHAR = u16(0xc823) // panel cevapları
// AE01 (JieLi OTA) bilerek tanımlanmaz: bu uygulama OTA kanalına asla yazmaz.

export const MFR_ID = 0x4801
export const ADV_SIGNATURE = [0x57, 0x00, 0x01]
export const NAME_PREFIX = 'SLQ-'

export const PANEL_W = 48
export const PANEL_H = 12
export const CHUNK_SIZE = 446 // uygulamadaki değer: ATT MTU 472 - 26

export type RGB = [number, number, number]

export const Status = { REJECTED: 0, OK: 1, SAME: 3 } as const

export enum Effect {
  FIXED = 0,
  LEFT = 1,
  RIGHT = 2,
  UP = 3,
  DOWN = 4,
  PAGE_5 = 5,
  PAGE_6 = 6,
  LASER = 7,
}

export enum GraffitiMode {
  NEW = 1,
  DONE = 2,
  EXIT = 4,
}

export enum PixelMode {
  DRAW = 0,
  MIRROR_H = 1,
  MIRROR_V = 2,
  ERASE = 4,
}

export enum BikeSignal {
  LEFT = 0,
  RIGHT = 1,
  RIDING = 2,
  STOPPED = 3,
}

// ---------------------------------------------------------------- CRC
/** CRC-16/MODBUS (poly 0xA001 yansıtılmış, init 0xFFFF), yüksek bayt önce. */
export function crc16(data: ArrayLike<number>): Uint8Array {
  let c = 0xffff
  for (let i = 0; i < data.length; i++) {
    c ^= data[i]
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xa001 : c >>> 1
  }
  return new Uint8Array([c >> 8, c & 0xff])
}

const CRC32C_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0x82f63b78 : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

/** CRC-32C (Castagnoli), büyük endian. Transfer başlatma komutlarında verinin özetidir. */
export function crc32c(data: ArrayLike<number>): Uint8Array {
  let c = 0xffffffff
  for (let i = 0; i < data.length; i++) c = CRC32C_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8)
  c = (c ^ 0xffffffff) >>> 0
  return new Uint8Array([c >>> 24, (c >>> 16) & 0xff, (c >>> 8) & 0xff, c & 0xff])
}

// ---------------------------------------------------------------- çerçeve
export function concat(...parts: ArrayLike<number>[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

/** CMD | SUB | LEN | PAYLOAD | CRC16_BE */
export function frame(cmd: number, sub: number, payload: ArrayLike<number> = []): Uint8Array {
  const body = concat([cmd, sub, payload.length], Array.from(payload, (x) => x & 0xff))
  return concat(body, crc16(body))
}

export interface Response {
  cmd: number
  sub: number
  payload: Uint8Array
  crcOk: boolean
  raw: Uint8Array
  chunkIndex?: number
}

/** C823 notify'ını çözer. Parça ACK'i (01 01 NO_hi NO_lo LEN …) özel biçimdedir. */
export function parseResponse(d: Uint8Array): Response | null {
  if (d.length < 5 || (d[0] === 0xfe && d[1] === 0xdc && d[2] === 0xba)) return null
  const c = crc16(d.subarray(0, d.length - 2))
  const crcOk = c[0] === d[d.length - 2] && c[1] === d[d.length - 1]
  if (d[0] === 0x01 && d[1] === 0x01 && d.length >= 7) {
    const n = d[4]
    return { cmd: 1, sub: 1, payload: d.slice(5, 5 + n), crcOk, raw: d, chunkIndex: (d[2] << 8) | d[3] }
  }
  return { cmd: d[0], sub: d[1], payload: d.slice(3, 3 + d[2]), crcOk, raw: d }
}

export interface PanelInfo {
  firmware: string
  hasPassword: boolean
  brightness: number
}

/** Durum sorgusu cevabı: 5A 01 0B + 11 bayt. */
export function parseInfo(r: Response): PanelInfo | null {
  if (r.cmd !== 0x5a || r.sub !== 0x01 || r.payload.length < 11) return null
  return { firmware: `1.0.${r.payload[1]}`, hasPassword: r.payload[2] === 1, brightness: r.payload[10] }
}

// ---------------------------------------------------------------- komutlar (C821)
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(v)))

export const queryInfo = () => frame(0x5a, 0x01, [1])
/** level 1..100. Panel cevap vermez. */
export const brightness = (level: number) => frame(0x00, 0x01, [clamp(level, 1, 100)])
export const power = (on: boolean) => frame(0x00, 0x03, [on ? 1 : 0])
export const rotate180 = (on: boolean) => frame(0x51, 0x01, [on ? 1 : 0])

export interface TextStyle {
  effect: Effect
  speed: number // 0..100
  colorIndex: number // 0 = rgb kullan; 1..7 hazır gradyanlar
  rgb: RGB
  bgIndex: number
  bgRgb: RGB
  orientation: number // 0 yatay, 1 dikey
}

/** Paneldeki metnin görünümünü metni yeniden göndermeden değiştirir (54 01). */
export const textStyle = (s: TextStyle) =>
  frame(0x54, 0x01, [s.effect, clamp(s.speed, 0, 100), s.colorIndex, ...s.rgb, s.bgIndex, ...s.bgRgb, s.orientation])

export const graffiti = (mode: GraffitiMode) => frame(0x0b, 0x01, [mode])
/** x 0..47 (sütun), y 0..11 (satır). Panel cevap vermez. */
export const pixel = (x: number, y: number, rgb: RGB, mode: PixelMode = PixelMode.DRAW) =>
  frame(0x0c, 0x01, [mode, x, y, ...rgb])

/** style 0..4, 12 bant, her biri 0..16. Panel cevap vermez; müzik boyunca sürekli gönderilir. */
export function rhythm(style: number, bands: number[]): Uint8Array {
  if (bands.length !== 12) throw new Error('12 bant gerekli')
  return frame(0x0d, 0x01, [style, ...bands.map((b) => clamp(b, 0, 16))])
}
export const rhythmOff = () => frame(0x0d, 0x02, [1])

export const bikeSignal = (s: BikeSignal) => frame(0x10, 0x01, [s])
export function bikeSpeed(value: number, mph = false): Uint8Array {
  const v = Math.max(0, Math.min(255.9, value))
  const whole = Math.floor(v)
  return frame(0x11, 0x01, [mph ? 1 : 0, whole, Math.round((v - whole) * 10) % 10])
}

export const playlistBegin = (count: number) => frame(0x0a, 0x01, [count])
/** Panel fabrika demo animasyonlarına döner. */
export const playlistClear = () => frame(0x0a, 0x02, [0])

const dateBytes = (n: Date) => [n.getFullYear() >> 8, n.getFullYear() & 0xff, n.getMonth(), n.getDate() - 1]

/** Saat göstergesi (0E 01). style 0..3. z / z2'nin etkisi doğrulanmadı. */
export function clock(style = 1, now = new Date(), z = 1, z2 = 0): Uint8Array {
  return frame(0x0e, 0x01, [style, z, z2, ...dateBytes(now), now.getHours(), now.getMinutes(), now.getSeconds()])
}

/** bit0 = 1 etkin (doğrulandı); FF = her gün. Kapalı için 00 (01 "etkin, gün yok" demektir). */
export const scheduleByte = (enabled: boolean) => (enabled ? 0xff : 0x00)

export type HM = [number, number]

/** Otomatik aç/kapa (0F 01). on/off = [saat, dakika] ya da null (kapalı). Panel saatini de ayarlar. */
export function schedule(on: HM | null, off: HM | null, now = new Date()): Uint8Array {
  const [onH, onM] = on ?? [0, 0]
  const [offH, offM] = off ?? [0, 0]
  return frame(0x0f, 0x01, [
    ...dateBytes(now), now.getHours(), now.getMinutes(), now.getSeconds(),
    onH, onM, scheduleByte(on !== null),
    offH, offM, scheduleByte(off !== null),
  ])
}

export const sync = () => frame(0x55, 0x01, [1])
export const reset = () => frame(0x50, 0x01, [1])

// ---------------------------------------------------------------- transfer (C821 + C822)
export interface TextStart {
  index?: number // 0 = doğrudan göster, 1..N = playlist öğesi
  effect?: Effect
  speed?: number
  colorIndex?: number
  bgIndex?: number
  bgRgb?: RGB
  orientation?: number
}

export function textStart(data: Uint8Array, o: TextStart = {}): Uint8Array {
  const n = data.length
  return frame(0x02, 0x01, [
    o.index ?? 0, n >> 8, n & 0xff, o.effect ?? Effect.FIXED, clamp(o.speed ?? 100, 0, 100),
    o.colorIndex ?? 0, o.bgIndex ?? 0, ...(o.bgRgb ?? [0, 0, 0]), o.orientation ?? 0, ...crc32c(data),
  ])
}

/** data = GIF dosyasının baytları (48x12). */
export const imageStart = (data: Uint8Array, index = 0) => frame(0x08, 0x02, [index, ...crc32c(data)])

/** Uygulamanın gönderdiği biçim: içteki CRC'li çerçeveye bir CRC daha eklenir (8 bayt). */
export function transferDone(): Uint8Array {
  const body = [0x01, 0x02, 0x01, 0x01]
  const inner = concat(body, crc16(body))
  return concat(inner, crc16(inner))
}

export const TEXT_CHUNK_HEADER = [0x01, 0x02, 0x01]
export const IMAGE_CHUNK_HEADER = [0x01, 0x08, 0x02]

/** C822 parçaları: HEADER | TOPLAM u32 BE | NO u16 BE | UZ u16 BE | VERİ | CRC16 BE */
export function chunks(header: number[], data: Uint8Array, size = CHUNK_SIZE): Uint8Array[] {
  const out: Uint8Array[] = []
  const n = data.length
  for (let i = 0, off = 0; off < n; i++, off += size) {
    const part = data.subarray(off, off + size)
    const body = concat(
      header,
      [n >>> 24, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff],
      [i >> 8, i & 0xff, part.length >> 8, part.length & 0xff],
      part,
    )
    out.push(concat(body, crc16(body)))
  }
  return out
}

export const hex = (d: ArrayLike<number>) => Array.from(d, (b) => b.toString(16).padStart(2, '0')).join(' ')

export function parseHex(s: string): Uint8Array {
  const clean = s.replace(/0x/gi, '').replace(/[^0-9a-f]/gi, '')
  if (clean.length % 2) throw new Error('tek sayıda hex hane')
  return Uint8Array.from(clean.match(/../g) ?? [], (h) => parseInt(h, 16))
}
