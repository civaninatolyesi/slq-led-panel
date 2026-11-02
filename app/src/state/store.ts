import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Panel, type TransferResult } from '../ble/panel'
import { getBackend, type Backend, type FoundDevice, type Link } from '../ble/transport'
import type { Frame } from '../core/media'
import * as P from '../core/protocol'

export type ConnState = 'idle' | 'checking' | 'scanning' | 'connecting' | 'connected' | 'reconnecting'
export type Lang = 'tr' | 'en'
export type Theme = 'dark' | 'light' | 'system'

export interface Toast {
  id: number
  kind: 'ok' | 'error' | 'info'
  text: string
}

/** Panelde şu an gösterildiği varsayılan içerik (ana sayfadaki önizleme için). */
export type NowShowing =
  | { kind: 'frames'; frames: Frame[]; label: string }
  | { kind: 'text'; label: string; render: (t: number) => Uint8ClampedArray }
  | { kind: 'mode'; label: string }
  | null

export interface PlaylistItem {
  id: string
  kind: 'text' | 'gif'
  label: string
  /** text: kodlanmış metin verisi (base64) + başlatma seçenekleri; gif: GIF baytları (base64). */
  data: string
  opts?: P.TextStart
  /** Önizleme kareleri (serializeFrames). */
  thumb: string
}

interface Store {
  // bağlantı
  conn: ConnState
  backend: Backend | null
  panel: Panel | null
  devices: FoundDevice[]
  info: P.PanelInfo | null
  problem: null | 'no-bluetooth' | 'bt-off' | 'insecure'
  lastDevice: { id: string; name: string } | null
  // panel durumu (bilinen son değerler)
  brightness: number
  powerOn: boolean
  rotated: boolean
  now: NowShowing
  // iş durumu
  busy: { label: string; progress: number } | null
  toasts: Toast[]
  // ayarlar
  lang: Lang
  theme: Theme
  pickerOpen: boolean
  playlist: PlaylistItem[]

  init(): Promise<void>
  openPicker(): Promise<void>
  closePicker(): Promise<void>
  connectTo(id?: string, name?: string): Promise<void>
  disconnect(): Promise<void>
  toast(kind: Toast['kind'], text: string): void
  set(p: Partial<Store>): void
  /** Bir aktarımı ilerleme çubuğuyla çalıştırır. */
  run(label: string, fn: (p: Panel, progress: (f: number) => void) => Promise<TransferResult | boolean | void>): Promise<boolean>
}

let toastId = 0
let reconnectTimer: ReturnType<typeof setTimeout> | null = null

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      conn: 'idle',
      backend: null,
      panel: null,
      devices: [],
      info: null,
      problem: null,
      lastDevice: null,
      brightness: 60,
      powerOn: true,
      rotated: false,
      now: null,
      busy: null,
      toasts: [],
      lang: navigator.language?.toLowerCase().startsWith('tr') ? 'tr' : 'en',
      theme: 'dark',
      pickerOpen: false,
      playlist: [],

      set: (p) => set(p),

      toast(kind, text) {
        const id = ++toastId
        set((s) => ({ toasts: [...s.toasts.slice(-3), { id, kind, text }] }))
        setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), kind === 'error' ? 5000 : 2600)
      },

      async init() {
        const backend = await getBackend()
        set({ backend, conn: 'checking' })
        const problem = await backend.check()
        set({ problem, conn: 'idle' })
        const last = get().lastDevice
        if (!problem && last && backend.autoConnect) {
          set({ conn: 'connecting' })
          const link = await backend.autoConnect(last.id, last.name)
          if (link) await attach(link)
          else set({ conn: 'idle' })
        }
      },

      async openPicker() {
        const { backend } = get()
        if (!backend) return
        const problem = await backend.check()
        set({ problem })
        if (problem) return
        if (!backend.customPicker) {
          // Tarayıcı: kendi seçicisini açar
          await get().connectTo()
          return
        }
        set({ pickerOpen: true, devices: [], conn: 'scanning' })
        try {
          await backend.startScan((devices) => set({ devices }))
        } catch (e) {
          set({ pickerOpen: false, conn: 'idle' })
          get().toast('error', String((e as Error).message ?? e))
        }
      },

      async closePicker() {
        await get().backend?.stopScan()
        set({ pickerOpen: false, conn: get().panel ? 'connected' : 'idle' })
      },

      async connectTo(id, name) {
        const { backend } = get()
        if (!backend) return
        set({ conn: 'connecting' })
        try {
          const link = await backend.connect(id, name)
          set({ pickerOpen: false })
          await attach(link)
        } catch (e) {
          const msg = (e as Error).message
          set({ conn: 'idle', pickerOpen: false })
          if (msg !== 'cancelled') get().toast('error', msg)
        }
      },

      async disconnect() {
        if (reconnectTimer) clearTimeout(reconnectTimer)
        const { panel } = get()
        set({ panel: null, conn: 'idle', info: null, lastDevice: null })
        await panel?.link.disconnect()
      },

      async run(label, fn) {
        const { panel, busy } = get()
        if (!panel) {
          get().toast('info', get().lang === 'tr' ? 'Önce panele bağlan' : 'Connect to a panel first')
          return false
        }
        if (busy) return false
        set({ busy: { label, progress: 0 } })
        try {
          const r = await fn(panel, (f) => set({ busy: { label, progress: f } }))
          const ok = r === undefined || r === true || (typeof r === 'object' && r.ok)
          if (!ok) {
            const detail = typeof r === 'object' && r ? r.detail : ''
            get().toast('error', (get().lang === 'tr' ? 'Panel kabul etmedi' : 'Panel rejected') + (detail ? ` (${detail})` : ''))
          }
          return ok
        } catch (e) {
          get().toast('error', String((e as Error).message ?? e))
          return false
        } finally {
          set({ busy: null })
        }
      },
    }),
    {
      name: 'slq-studio',
      partialize: (s) => ({
        lastDevice: s.lastDevice,
        lang: s.lang,
        theme: s.theme,
        playlist: s.playlist,
        brightness: s.brightness,
        rotated: s.rotated,
      }),
    },
  ),
)

async function attach(link: Link) {
  const { set, toast } = useStore.getState()
  const panel = new Panel(link)
  link.onDisconnect = () => onLost(panel)
  set({ panel, conn: 'connected', lastDevice: { id: link.id, name: link.name } })
  const info = await panel.queryInfo().catch(() => null)
  set({ info, ...(info ? { brightness: info.brightness } : {}) })
  toast('ok', `${link.name} ✓`)
}

function onLost(panel: Panel) {
  const s = useStore.getState()
  if (s.panel !== panel) return
  s.set({ conn: 'reconnecting' })
  panel.emit('error', 'bağlantı koptu')
  let attempt = 0
  const tryAgain = async () => {
    if (useStore.getState().panel !== panel) return
    attempt++
    try {
      await panel.link.reconnect()
      useStore.getState().set({ conn: 'connected' })
      panel.emit('info', 'yeniden bağlandı')
    } catch {
      if (attempt >= 12) {
        useStore.getState().set({ conn: 'idle', panel: null })
        useStore.getState().toast('error', useStore.getState().lang === 'tr' ? 'Panel bağlantısı kayboldu' : 'Lost connection to panel')
        return
      }
      reconnectTimer = setTimeout(tryAgain, Math.min(1000 * 2 ** attempt, 8000))
    }
  }
  reconnectTimer = setTimeout(tryAgain, 600)
}
