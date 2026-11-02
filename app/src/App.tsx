import {
  AlarmClock,
  AlertCircle,
  Bike,
  Bluetooth,
  BluetoothSearching,
  CheckCircle2,
  Grid3x3,
  Home,
  Image,
  Info,
  ListMusic,
  Loader2,
  MoreHorizontal,
  Music,
  PenTool,
  Settings,
  Type,
} from 'lucide-react'
import { useEffect, useState, type ComponentType } from 'react'
import { Modal, useT } from './ui/controls'
import { useStore } from './state/store'
import HomePage from './pages/Home'
import TextPage from './pages/Text'
import MediaPage from './pages/Media'
import DrawPage from './pages/Draw'
import MusicPage from './pages/Music'
import BikePage from './pages/Bike'
import ClockPage from './pages/Clock'
import PlaylistPage from './pages/Playlist'
import SettingsPage from './pages/Settings'

export type PageId = 'home' | 'text' | 'media' | 'draw' | 'music' | 'bike' | 'clock' | 'playlist' | 'settings'

interface NavDef {
  id: PageId
  icon: ComponentType<{ size?: number }>
  tr: string
  en: string
  Page: ComponentType<{ go: (p: PageId) => void }>
}

export const NAV: NavDef[] = [
  { id: 'home', icon: Home, tr: 'Ana sayfa', en: 'Home', Page: HomePage },
  { id: 'text', icon: Type, tr: 'Yazı', en: 'Text', Page: TextPage },
  { id: 'media', icon: Image, tr: 'Görseller', en: 'Images', Page: MediaPage },
  { id: 'draw', icon: PenTool, tr: 'Canlı çizim', en: 'Live draw', Page: DrawPage },
  { id: 'music', icon: Music, tr: 'Müzik ritmi', en: 'Music', Page: MusicPage },
  { id: 'bike', icon: Bike, tr: 'Bisiklet', en: 'Bike', Page: BikePage },
  { id: 'clock', icon: AlarmClock, tr: 'Saat ve zamanlayıcı', en: 'Clock & timer', Page: ClockPage },
  { id: 'playlist', icon: ListMusic, tr: 'Playlist', en: 'Playlist', Page: PlaylistPage },
  { id: 'settings', icon: Settings, tr: 'Ayarlar', en: 'Settings', Page: SettingsPage },
]

const MOBILE_NAV: PageId[] = ['home', 'text', 'media', 'draw']

function usePage(): [PageId, (p: PageId) => void] {
  const read = () => (NAV.some((n) => n.id === location.hash.slice(1)) ? (location.hash.slice(1) as PageId) : 'home')
  const [page, setPage] = useState<PageId>(read)
  useEffect(() => {
    const h = () => setPage(read())
    window.addEventListener('hashchange', h)
    return () => window.removeEventListener('hashchange', h)
  }, [])
  const go = (p: PageId) => {
    if (p !== page) location.hash = p
    document.querySelector('.main')?.scrollTo({ top: 0 })
  }
  return [page, go]
}

export function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <div className="brand-mark" style={{ width: size, height: size }}>
      <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 20 20" fill="#fff">
        {[0, 1, 2].flatMap((y) =>
          [0, 1, 2].map((x) => <circle key={`${x}${y}`} cx={4 + x * 6} cy={4 + y * 6} r={(x + y) % 2 ? 1.6 : 2.3} opacity={(x + y) % 2 ? 0.6 : 1} />),
        )}
      </svg>
    </div>
  )
}

export function ConnPill({ compact }: { compact?: boolean }) {
  const t = useT()
  const { conn, lastDevice, panel, openPicker } = useStore()
  const label =
    conn === 'connected'
      ? lastDevice?.name ?? 'SLQ'
      : conn === 'connecting' || conn === 'checking'
        ? t('Bağlanıyor…', 'Connecting…')
        : conn === 'reconnecting'
          ? t('Yeniden bağlanıyor…', 'Reconnecting…')
          : t('Bağlı değil', 'Not connected')
  const cls = conn === 'connected' ? 'ok' : conn === 'idle' ? 'off' : 'warn'
  return (
    <button
      className={`chip ${cls}`}
      style={{ border: 0, cursor: 'pointer', height: compact ? 30 : 32, padding: '0 12px' }}
      onClick={() => !panel && conn === 'idle' && openPicker()}
    >
      <span className={`dot ${cls === 'warn' ? 'pulse' : ''}`} />
      {label}
    </button>
  )
}

function DevicePicker() {
  const t = useT()
  const { devices, conn, connectTo, closePicker, backend } = useStore()
  return (
    <Modal onClose={closePicker}>
      <h3>{t('Panelini seç', 'Choose your panel')}</h3>
      <p className="muted" style={{ marginTop: 0 }}>
        {t('Yakındaki SLQ paneller aranıyor. Panelin açık olduğundan emin ol.', 'Looking for nearby SLQ panels. Make sure your panel is switched on.')}
      </p>
      <div className="stack" style={{ gap: 8, marginTop: 14 }}>
        {devices.map((d) => (
          <button key={d.id} className="device" onClick={() => connectTo(d.id, d.name)} disabled={conn === 'connecting'}>
            <div className="device-icon">
              <Grid3x3 size={22} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{d.name}</div>
              <div className="faint">
                {backend?.kind === 'native' ? d.id : t('LED panel', 'LED panel')}
                {d.rssi != null && ` · ${d.rssi} dBm`}
              </div>
            </div>
            {conn === 'connecting' ? <Loader2 className="spin" size={20} /> : <Bluetooth size={20} />}
          </button>
        ))}
        <div className="scan-anim">
          <div className="radar" />
          <div>
            {devices.length ? t('Aramaya devam ediliyor…', 'Still searching…') : t('Aranıyor…', 'Searching…')}
            <div className="faint">
              {t(
                'Görünmüyorsa: telefondaki üretici uygulamasını kapat. Panel aynı anda tek cihaza bağlanır.',
                "Not showing up? Close the vendor app on your phone — the panel accepts one connection at a time.",
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}

function Toasts() {
  const toasts = useStore((s) => s.toasts)
  return (
    <div className="toasts">
      {toasts.map((x) => (
        <div key={x.id} className={`toast ${x.kind}`}>
          {x.kind === 'ok' ? <CheckCircle2 size={18} /> : x.kind === 'error' ? <AlertCircle size={18} /> : <Info size={18} />}
          {x.text}
        </div>
      ))}
    </div>
  )
}

function Busy() {
  const t = useT()
  const busy = useStore((s) => s.busy)
  if (!busy) return null
  return (
    <div className="busy">
      <div className="row between">
        <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Loader2 size={16} className="spin" /> {busy.label}
        </span>
        <span className="faint">{Math.round(busy.progress * 100)}%</span>
      </div>
      <div className="bar">
        <div style={{ width: `${Math.max(4, busy.progress * 100)}%` }} />
      </div>
      <div className="faint" style={{ marginTop: 6 }}>
        {t('Panele aktarılıyor, uygulamayı kapatma.', 'Uploading to the panel, keep the app open.')}
      </div>
    </div>
  )
}

function MoreSheet({ go, onClose }: { go: (p: PageId) => void; onClose: () => void }) {
  const t = useT()
  return (
    <Modal onClose={onClose}>
      <h3 style={{ marginBottom: 16 }}>{t('Tüm özellikler', 'All features')}</h3>
      <div className="sheet-grid">
        {NAV.filter((n) => !MOBILE_NAV.includes(n.id)).map((n) => (
          <button
            key={n.id}
            className="tile"
            onClick={() => {
              go(n.id)
              onClose()
            }}
          >
            <n.icon size={22} />
            {t(n.tr, n.en)}
          </button>
        ))}
      </div>
    </Modal>
  )
}

export default function App() {
  const t = useT()
  const [page, go] = usePage()
  const [more, setMore] = useState(false)
  const { pickerOpen, theme, init } = useStore()

  useEffect(() => {
    void init()
  }, [init])

  useEffect(() => {
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
      document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    }
    apply()
    const mq = matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])

  const Current = NAV.find((n) => n.id === page)!.Page

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <BrandMark />
          <div>
            <div className="brand-name">SLQ Studio</div>
            <div className="brand-sub">{t('LED panel kontrolü', 'LED panel control')}</div>
          </div>
        </div>
        {NAV.map((n, i) => (
          <div key={n.id}>
            {(i === 1 || i === 8) && <div className="nav-sep" />}
            <button className={`nav-item ${page === n.id ? 'active' : ''}`} onClick={() => go(n.id)} style={{ width: '100%' }}>
              <n.icon size={19} />
              {t(n.tr, n.en)}
            </button>
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ padding: '0 6px' }}>
          <ConnPill />
        </div>
      </aside>

      <header className="topbar">
        <div className="row" style={{ gap: 10 }}>
          <BrandMark size={30} />
          <b>SLQ Studio</b>
        </div>
        <ConnPill compact />
      </header>

      <main className="main">
        <Current go={go} key={page} />
      </main>

      <nav className="bottom-nav">
        {NAV.filter((n) => MOBILE_NAV.includes(n.id)).map((n) => (
          <button key={n.id} className={page === n.id ? 'active' : ''} onClick={() => go(n.id)}>
            <n.icon size={22} />
            {t(n.tr, n.en).split(' ')[0]}
          </button>
        ))}
        <button className={!MOBILE_NAV.includes(page) ? 'active' : ''} onClick={() => setMore(true)}>
          <MoreHorizontal size={22} />
          {t('Daha fazla', 'More')}
        </button>
      </nav>

      {more && <MoreSheet go={go} onClose={() => setMore(false)} />}
      {pickerOpen && <DevicePicker />}
      <Toasts />
      <Busy />
    </div>
  )
}

export function ConnectHint() {
  const t = useT()
  const { panel, openPicker, conn } = useStore()
  if (panel) return null
  return (
    <div className="notice info" style={{ alignItems: 'center' }}>
      <BluetoothSearching size={20} />
      <div style={{ flex: 1 }}>{t('Göndermek için önce panele bağlan.', 'Connect to your panel to send.')}</div>
      <button className="btn sm primary" onClick={openPicker} disabled={conn !== 'idle'}>
        {t('Bağlan', 'Connect')}
      </button>
    </div>
  )
}
