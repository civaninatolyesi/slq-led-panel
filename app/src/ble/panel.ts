/**
 * Panel oturumu — slq/ble.py'deki Panel sınıfının karşılığı.
 * Tüm işlemler tek sırada yürür (BLE aynı anda tek GATT işlemi kabul eder). Transfer akışı:
 * docs/protocol/04-transfers.md
 */
import * as P from '../core/protocol'
import type { Channel, Link } from './transport'

export interface LogEntry {
  t: number
  kind: 'tx' | 'rx' | 'info' | 'error'
  text: string
}

export interface TransferResult {
  ok: boolean
  same?: boolean
  detail: string
}

export type Progress = (done: number, total: number) => void

const CMD_TIMEOUT = 1500
const STEP_TIMEOUT = 4000

export class Panel {
  private inbox: Uint8Array[] = []
  private waiter: (() => void) | null = null
  private queue: Promise<unknown> = Promise.resolve()
  private latestFrames = new Map<string, Uint8Array>()
  private logListeners = new Set<(e: LogEntry) => void>()
  readonly log: LogEntry[] = []
  /** Web Bluetooth MTU bildirmez; büyük parça başarısız olursa küçüğe düşülür. */
  private chunkSize: number

  constructor(readonly link: Link) {
    link.onNotify = (d) => {
      this.emit('rx', `c823 ${P.hex(d)}`)
      this.inbox.push(d)
      this.waiter?.()
    }
    this.chunkSize = link.mtu ? Math.max(7, Math.min(P.CHUNK_SIZE, link.mtu - 26)) : P.CHUNK_SIZE
  }

  // ---------------------------------------------------------------- log
  onLog(cb: (e: LogEntry) => void) {
    this.logListeners.add(cb)
    return () => {
      this.logListeners.delete(cb)
    }
  }

  emit(kind: LogEntry['kind'], text: string) {
    const e = { t: Date.now(), kind, text }
    this.log.push(e)
    if (this.log.length > 400) this.log.splice(0, this.log.length - 400)
    this.logListeners.forEach((cb) => cb(e))
  }

  // ---------------------------------------------------------------- düşük seviye
  /** fn'i sıraya koyar; önceki işlemler bitmeden başlamaz. */
  exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn)
    this.queue = run.catch(() => {})
    return run
  }

  private async write(ch: Channel, d: Uint8Array) {
    this.emit('tx', `${ch === 'cmd' ? 'c821' : 'c822'} ${P.hex(d)}`)
    await this.link.write(ch, d)
  }

  private drain() {
    this.inbox = []
  }

  private async waitFor(pred: (d: Uint8Array) => boolean, ms: number): Promise<Uint8Array | null> {
    const end = Date.now() + ms
    for (;;) {
      while (this.inbox.length) {
        const d = this.inbox.shift()!
        if (pred(d)) return d
      }
      const left = end - Date.now()
      if (left <= 0) return null
      await new Promise<void>((res) => {
        const t = setTimeout(res, left)
        this.waiter = () => {
          clearTimeout(t)
          res()
        }
      })
      this.waiter = null
    }
  }

  // ---------------------------------------------------------------- komutlar
  /** Sessiz komut (parlaklık, piksel, ritim …): yazar, cevap beklemez. */
  send(frame: Uint8Array): Promise<void> {
    return this.exclusive(() => this.write('cmd', frame))
  }

  /**
   * Sık güncellenen değerler için (kaydırıcı, ritim, hız): kuyrukta bekleyen aynı anahtarlı komut
   * en yenisiyle değiştirilir, panel eski değerlerle meşgul edilmez.
   */
  sendLatest(key: string, frame: Uint8Array): Promise<void> {
    const queued = this.latestFrames.has(key)
    this.latestFrames.set(key, frame)
    if (queued) return Promise.resolve()
    return this.exclusive(async () => {
      const f = this.latestFrames.get(key)!
      this.latestFrames.delete(key)
      await this.write('cmd', f)
    })
  }

  /** Cevaplı komut: CMD SUB 01 ST bekler. ST=1 ise true. */
  commandOk(frame: Uint8Array, timeout = CMD_TIMEOUT): Promise<boolean> {
    return this.exclusive(async () => {
      this.drain()
      await this.write('cmd', frame)
      const r = await this.waitFor((d) => d[0] === frame[0] && d[1] === frame[1] && d.length > 3, timeout)
      if (!r) this.emit('error', `${P.hex(frame.subarray(0, 2))}: cevap gelmedi`)
      else if (r[3] !== P.Status.OK) this.emit('error', `${P.hex(frame.subarray(0, 2))}: reddedildi (ST=${r[3]})`)
      return !!r && r[3] === P.Status.OK
    })
  }

  /** Ham komut (geliştirici konsolu): yazar, wait ms boyunca gelen cevapları döndürür. */
  raw(frame: Uint8Array, wait = 600): Promise<Uint8Array[]> {
    return this.exclusive(async () => {
      this.drain()
      await this.write('cmd', frame)
      await new Promise((r) => setTimeout(r, wait))
      const got = this.inbox
      this.inbox = []
      return got
    })
  }

  queryInfo(): Promise<P.PanelInfo | null> {
    return this.exclusive(async () => {
      this.drain()
      await this.write('cmd', P.queryInfo())
      const d = await this.waitFor((x) => x[0] === 0x5a && x[1] === 0x01, CMD_TIMEOUT)
      const r = d && P.parseResponse(d)
      return r ? P.parseInfo(r) : null
    })
  }

  // ---------------------------------------------------------------- transfer
  transfer(start: Uint8Array, header: number[], data: Uint8Array, progress?: Progress): Promise<TransferResult> {
    return this.exclusive(async () => {
      for (;;) {
        const r = await this.transferOnce(start, header, data, progress)
        // Parça boyutu düşürülerek tekrar denenebilecek tek durum: ilk parçanın hiç geçmemesi.
        if (r.ok || !r.firstChunkFailed || this.link.mtu) return r
        const next = this.chunkSize > 160 ? 160 : this.chunkSize > 7 ? 7 : 0
        if (!next) return r
        this.emit('info', `parça boyutu ${this.chunkSize} -> ${next}`)
        this.chunkSize = next
        await new Promise((res) => setTimeout(res, 300))
      }
    })
  }

  private async transferOnce(
    start: Uint8Array,
    header: number[],
    data: Uint8Array,
    progress?: Progress,
  ): Promise<TransferResult & { firstChunkFailed?: boolean }> {
    const [cmd, sub] = start
    this.drain()
    await this.write('cmd', start)
    const go = await this.waitFor((d) => d[0] === cmd && d[1] === sub && d.length > 3, STEP_TIMEOUT)
    if (!go) return { ok: false, detail: 'no-start' }
    if (go[3] === P.Status.SAME) {
      progress?.(1, 1)
      return { ok: true, same: true, detail: 'same' }
    }
    if (go[3] !== P.Status.OK) return { ok: false, detail: `rejected ${P.hex(go)}` }
    const parts = P.chunks(header, data, this.chunkSize)
    for (let i = 0; i < parts.length; i++) {
      try {
        await this.write('data', parts[i])
      } catch (e) {
        return { ok: false, detail: `write ${(e as Error).message}`, firstChunkFailed: i === 0 }
      }
      const ack = await this.waitFor((d) => d.length >= 4 && d[0] === 1, STEP_TIMEOUT)
      if (!ack) return { ok: false, detail: `no-ack ${i + 1}/${parts.length}`, firstChunkFailed: i === 0 }
      if (ack[1] === 2 && ack[3] > 1) return { ok: false, detail: `data-error ${P.hex(ack)}` }
      progress?.(i + 1, parts.length)
    }
    await this.write('cmd', P.transferDone())
    const end = await this.waitFor((d) => d.length >= 4 && d[0] === 1 && d[1] === 2, STEP_TIMEOUT)
    if (!end) return { ok: false, detail: 'no-end' }
    return { ok: end[3] === P.Status.OK, detail: `${data.length} B, ${parts.length} parça` }
  }

  sendText(data: Uint8Array, opts: P.TextStart, progress?: Progress) {
    return this.transfer(P.textStart(data, opts), P.TEXT_CHUNK_HEADER, data, progress)
  }

  sendGif(gif: Uint8Array, index = 0, progress?: Progress) {
    return this.transfer(P.imageStart(gif, index), P.IMAGE_CHUNK_HEADER, gif, progress)
  }

  /** Playlist: 0A 01 N, ardından her öğe IDX = 1..N ile. Panel öğeler arasında kendisi döner. */
  async sendPlaylist(
    items: ({ kind: 'text'; data: Uint8Array; opts: P.TextStart } | { kind: 'gif'; data: Uint8Array })[],
    progress?: (item: number, frac: number) => void,
  ): Promise<TransferResult> {
    if (!(await this.commandOk(P.playlistBegin(items.length), STEP_TIMEOUT)))
      return { ok: false, detail: 'playlist-begin' }
    for (let k = 0; k < items.length; k++) {
      const it = items[k]
      const p: Progress = (d, t) => progress?.(k, d / t)
      const r =
        it.kind === 'gif'
          ? await this.sendGif(it.data, k + 1, p)
          : await this.sendText(it.data, { ...it.opts, index: k + 1 }, p)
      if (!r.ok) return { ok: false, detail: `item ${k + 1}: ${r.detail}` }
      await new Promise((res) => setTimeout(res, 120))
    }
    return { ok: true, detail: `${items.length}` }
  }
}
