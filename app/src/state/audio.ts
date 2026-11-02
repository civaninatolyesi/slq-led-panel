/**
 * Müzik ritmi motoru: ses kaynağını 12 banda böler ve 0D 01 ile panele akıtır.
 * Sayfa değişse de çalmaya devam etsin diye modül düzeyinde tek örnektir.
 */
import * as P from '../core/protocol'
import { useStore } from './store'

export type Source = 'mic' | 'file' | 'system'

const BANDS = 12
const SEND_MS = 55

class RhythmEngine {
  running = false
  source: Source = 'mic'
  style = 0
  sensitivity = 1
  bands = new Array(BANDS).fill(0)
  fileName = ''
  private ctx: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private stream: MediaStream | null = null
  private audioEl: HTMLAudioElement | null = null
  private raf = 0
  private lastSend = 0
  private peak = 60
  private listeners = new Set<() => void>()

  subscribe(cb: () => void) {
    this.listeners.add(cb)
    return () => {
      this.listeners.delete(cb)
    }
  }

  private notify() {
    this.listeners.forEach((cb) => cb())
  }

  async start(source: Source, file?: File) {
    await this.stop(false)
    this.source = source
    const ctx = new AudioContext()
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 2048
    analyser.smoothingTimeConstant = 0.55
    if (source === 'file') {
      if (!file) throw new Error('dosya yok')
      const el = new Audio(URL.createObjectURL(file))
      el.loop = true
      this.fileName = file.name
      const node = ctx.createMediaElementSource(el)
      node.connect(analyser)
      analyser.connect(ctx.destination)
      await el.play()
      this.audioEl = el
    } else {
      const stream =
        source === 'mic'
          ? await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
          : await navigator.mediaDevices.getDisplayMedia({ audio: true, video: true })
      stream.getVideoTracks().forEach((t) => t.stop())
      if (!stream.getAudioTracks().length) throw new Error('ses yok')
      ctx.createMediaStreamSource(stream).connect(analyser)
      this.stream = stream
    }
    this.ctx = ctx
    this.analyser = analyser
    this.running = true
    this.loop()
    this.notify()
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop)
    const a = this.analyser!
    const data = new Uint8Array(a.frequencyBinCount)
    a.getByteFrequencyData(data)
    const hz = this.ctx!.sampleRate / a.fftSize
    const out: number[] = []
    let frameMax = 0
    for (let b = 0; b < BANDS; b++) {
      const lo = 50 * Math.pow(10000 / 50, b / BANDS)
      const hi = 50 * Math.pow(10000 / 50, (b + 1) / BANDS)
      let sum = 0
      let n = 0
      for (let i = Math.floor(lo / hz); i <= Math.ceil(hi / hz) && i < data.length; i++) {
        sum += data[i]
        n++
      }
      const v = n ? sum / n : 0
      frameMax = Math.max(frameMax, v)
      out.push(v)
    }
    // Otomatik kazanç: tepe değeri yavaşça düşer, ani yükselişleri yakalar
    this.peak = Math.max(frameMax, this.peak * 0.995, 40)
    const floor = 18
    this.bands = out.map((v) => Math.max(0, Math.min(16, Math.round(((v - floor) / (this.peak - floor)) * 16 * this.sensitivity))))
    this.notify()
    const now = performance.now()
    const panel = useStore.getState().panel
    if (panel && now - this.lastSend > SEND_MS) {
      this.lastSend = now
      void panel.sendLatest('rhythm', P.rhythm(this.style, this.bands)).catch(() => {})
    }
  }

  async stop(sendOff = true) {
    cancelAnimationFrame(this.raf)
    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = null
    if (this.audioEl) {
      this.audioEl.pause()
      URL.revokeObjectURL(this.audioEl.src)
      this.audioEl = null
    }
    await this.ctx?.close().catch(() => {})
    this.ctx = null
    this.analyser = null
    const was = this.running
    this.running = false
    this.bands = new Array(BANDS).fill(0)
    this.notify()
    if (sendOff && was) await useStore.getState().panel?.commandOk(P.rhythmOff())
  }
}

export const rhythm = new RhythmEngine()
