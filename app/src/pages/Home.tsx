import {
  AlarmClock,
  AlertTriangle,
  Bike,
  Bluetooth,
  FlipVertical2,
  Image,
  ListMusic,
  Music,
  PenTool,
  Power,
  RotateCcw,
  Send,
  Sparkles,
  Sun,
  Type,
  Unplug,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import type { PageId } from '../App'
import { PRESETS, presetFrames } from '../core/animations'
import { encodeGif } from '../core/media'
import { framesRenderer, textRenderer } from '../core/preview'
import * as P from '../core/protocol'
import { encodeText, rainbow } from '../core/text'
import { isElectron, isNative } from '../ble/transport'
import { Card, Slider, Switch, useT } from '../ui/controls'
import { LedMatrix } from '../ui/LedMatrix'
import { useStore } from '../state/store'

const FEATURES: { id: PageId; icon: typeof Type; color: string; tr: [string, string]; en: [string, string] }[] = [
  { id: 'text', icon: Type, color: '#8b5cf6', tr: ['Yazı', 'Kayan yazı, renk, efekt'], en: ['Text', 'Scrolling text, colours, effects'] },
  { id: 'media', icon: Image, color: '#22d3ee', tr: ['Görseller', 'Animasyon, GIF, resim'], en: ['Images', 'Animations, GIFs, photos'] },
  { id: 'draw', icon: PenTool, color: '#f472b6', tr: ['Canlı çizim', 'Parmağınla anında çiz'], en: ['Live draw', 'Draw in real time'] },
  { id: 'music', icon: Music, color: '#34d399', tr: ['Müzik ritmi', 'Sese göre ekolayzır'], en: ['Music', 'Sound-reactive equaliser'] },
  { id: 'bike', icon: Bike, color: '#fbbf24', tr: ['Bisiklet', 'Sinyal ve hız göstergesi'], en: ['Bike', 'Turn signals and speed'] },
  { id: 'clock', icon: AlarmClock, color: '#60a5fa', tr: ['Saat', 'Saat ve otomatik aç/kapa'], en: ['Clock', 'Clock and auto on/off'] },
  { id: 'playlist', icon: ListMusic, color: '#fb923c', tr: ['Playlist', 'İçerikleri sırayla oynat'], en: ['Playlist', 'Rotate through content'] },
]

function Onboarding() {
  const t = useT()
  const { openPicker, conn, problem } = useStore()
  const busy = conn === 'connecting' || conn === 'checking' || conn === 'scanning'
  const demo = useMemo(() => framesRenderer(presetFrames(PRESETS[0])), [])
  return (
    <Card className="hero">
      <LedMatrix render={demo} />
      <h2 style={{ fontSize: 22, margin: '20px 0 4px', letterSpacing: '-0.02em' }}>{t('Panelini bağla', 'Connect your panel')}</h2>
      <div className="steps">
        <div className="step">
          <span className="step-n">1</span>
          {t('Paneli aç (kask panelindeki düğme).', 'Switch the panel on.')}
        </div>
        <div className="step">
          <span className="step-n">2</span>
          {t('Telefondaki üretici uygulaması açıksa kapat — panel tek bağlantı kabul eder.', 'Close the vendor app on your phone — the panel accepts a single connection.')}
        </div>
        <div className="step">
          <span className="step-n">3</span>
          {t('Aşağıdaki düğmeye bas ve listeden "SLQ-…" ile başlayan paneli seç.', 'Press the button below and pick the panel named "SLQ-…".')}
        </div>
      </div>
      {problem && <Problem kind={problem} />}
      <button className="btn primary lg" onClick={openPicker} disabled={busy} style={{ marginTop: problem ? 14 : 0 }}>
        <Bluetooth size={20} />
        {busy ? t('Bağlanıyor…', 'Connecting…') : t('Panele bağlan', 'Connect to panel')}
      </button>
    </Card>
  )
}

function Problem({ kind }: { kind: 'no-bluetooth' | 'bt-off' | 'insecure' }) {
  const t = useT()
  const msg =
    kind === 'bt-off'
      ? t('Bluetooth kapalı görünüyor. Bluetooth\'u açıp tekrar dene.', 'Bluetooth seems to be off. Turn it on and try again.')
      : kind === 'insecure'
        ? t('Bu sayfa güvenli bağlantı (https) üzerinden açılmalı.', 'This page must be opened over https.')
        : isElectron() || isNative()
          ? t('Bu cihazda Bluetooth bulunamadı.', 'No Bluetooth adapter found on this device.')
          : t(
              'Bu tarayıcı Bluetooth desteklemiyor. Chrome ya da Edge kullan veya masaüstü/Android uygulamasını indir.',
              "This browser doesn't support Bluetooth. Use Chrome or Edge, or download the desktop/Android app.",
            )
  return (
    <div className="notice">
      <AlertTriangle size={18} />
      <div>{msg}</div>
    </div>
  )
}

function QuickText() {
  const t = useT()
  const { run, set } = useStore()
  const [text, setText] = useState('')
  const send = async () => {
    const s = text.trim()
    if (!s) return
    const enc = encodeText(s, (i, n) => rainbow(i, n))
    const opts = { effect: P.Effect.LEFT, speed: 60 }
    const ok = await run(t('Yazı gönderiliyor', 'Sending text'), (p, prog) => p.sendText(enc.data, opts, (d, n) => prog(d / n)))
    if (ok)
      set({
        now: { kind: 'text', label: s, render: textRenderer(enc, { effect: opts.effect, speed: opts.speed, colorIndex: 0, bg: [0, 0, 0], vertical: false }) },
      })
  }
  return (
    <div className="row" style={{ flexWrap: 'nowrap' }}>
      <input
        className="input"
        placeholder={t('Hızlı yazı… (Enter ile gönder)', 'Quick text… (Enter to send)')}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && send()}
        maxLength={120}
      />
      <button className="btn primary icon" onClick={send} aria-label="send">
        <Send size={18} />
      </button>
    </div>
  )
}

export default function HomePage({ go }: { go: (p: PageId) => void }) {
  const t = useT()
  const s = useStore()
  const connected = !!s.panel

  const nowRender = useMemo(() => {
    const n = s.now
    if (!n) return null
    if (n.kind === 'frames') return framesRenderer(n.frames)
    if (n.kind === 'text') return n.render
    return null
  }, [s.now])

  const setBrightness = (v: number) => {
    s.set({ brightness: v })
    s.panel?.sendLatest('brightness', P.brightness(v))
  }

  const togglePower = async (on: boolean) => {
    s.set({ powerOn: on })
    await s.run(on ? t('Ekran açılıyor', 'Turning on') : t('Ekran kapanıyor', 'Turning off'), (p) => p.commandOk(P.power(on)))
  }

  const toggleRotate = async (on: boolean) => {
    s.set({ rotated: on })
    await s.run(t('Döndürülüyor', 'Rotating'), (p) => p.commandOk(P.rotate180(on)))
  }

  const sendPreset = async (id: string) => {
    const pr = PRESETS.find((x) => x.id === id)!
    const frames = presetFrames(pr)
    const gif = encodeGif(frames)
    const ok = await s.run(t('Animasyon gönderiliyor', 'Sending animation'), (p, prog) => p.sendGif(gif, 0, (d, n) => prog(d / n)))
    if (ok) s.set({ now: { kind: 'frames', frames, label: pr.name[s.lang] } })
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{connected ? t('Kontrol merkezi', 'Control center') : t('Hoş geldin 👋', 'Welcome 👋')}</h1>
          <p className="page-sub">
            {connected
              ? t('Panelin hazır. Ne göstermek istersin?', 'Your panel is ready. What would you like to show?')
              : t('SLQ LED panelini birkaç dokunuşla yönet.', 'Control your SLQ LED panel in a few taps.')}
          </p>
        </div>
      </div>

      {!connected ? (
        <div className="split">
          <Onboarding />
          <Card title={t('Neler yapabilirsin', 'What you can do')}>
            <div className="stack" style={{ gap: 10 }}>
              {FEATURES.map((f) => (
                <div key={f.id} className="row" style={{ flexWrap: 'nowrap' }}>
                  <div className="feature-icon" style={{ background: `${f.color}22`, color: f.color }}>
                    <f.icon size={19} />
                  </div>
                  <div>
                    <b style={{ fontSize: 14 }}>{s.lang === 'tr' ? f.tr[0] : f.en[0]}</b>
                    <div className="faint">{s.lang === 'tr' ? f.tr[1] : f.en[1]}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      ) : (
        <div className="stack">
          <div className="split">
            <Card className="hero">
              <div className="row between" style={{ marginBottom: 14 }}>
                <div className="row">
                  <span className={`chip ${s.conn === 'connected' ? 'ok' : 'warn'}`}>
                    <span className={`dot ${s.conn === 'connected' ? '' : 'pulse'}`} />
                    {s.conn === 'connected' ? t('Bağlı', 'Connected') : t('Yeniden bağlanıyor', 'Reconnecting')}
                  </span>
                  <b>{s.lastDevice?.name}</b>
                  {s.info && <span className="faint">FW {s.info.firmware}</span>}
                </div>
                <button className="btn ghost sm" onClick={s.disconnect}>
                  <Unplug size={15} />
                  {t('Bağlantıyı kes', 'Disconnect')}
                </button>
              </div>
              <LedMatrix render={nowRender} badge={s.now ? (s.now.kind === 'mode' ? s.now.label : t('PANELDE', 'ON PANEL')) : undefined}>
                {!s.now && (
                  <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'rgba(255,255,255,.5)', fontSize: 13 }}>
                    {t('Gönderdiğin içerik burada görünür', 'What you send appears here')}
                  </div>
                )}
              </LedMatrix>
              <div style={{ marginTop: 14 }}>
                <QuickText />
              </div>
            </Card>

            <Card title={t('Hızlı kontrol', 'Quick controls')}>
              <div className="setting">
                <div className="row" style={{ flexWrap: 'nowrap' }}>
                  <Power size={18} />
                  <div>
                    <div className="setting-title">{t('Ekran', 'Display')}</div>
                    <div className="setting-desc">{t('Kapatmak içeriği silmez', 'Turning off keeps the content')}</div>
                  </div>
                </div>
                <Switch on={s.powerOn} onChange={togglePower} />
              </div>
              <div className="setting" style={{ display: 'block' }}>
                <Slider
                  label={
                    <span className="row" style={{ gap: 8 }}>
                      <Sun size={16} />
                      {t('Parlaklık', 'Brightness')}
                    </span>
                  }
                  value={s.brightness}
                  min={1}
                  max={100}
                  unit="%"
                  onChange={setBrightness}
                />
              </div>
              <div className="setting">
                <div className="row" style={{ flexWrap: 'nowrap' }}>
                  <FlipVertical2 size={18} />
                  <div>
                    <div className="setting-title">{t('180° çevir', 'Rotate 180°')}</div>
                    <div className="setting-desc">{t('Panel ters takılıysa', 'If the panel is mounted upside down')}</div>
                  </div>
                </div>
                <Switch on={s.rotated} onChange={toggleRotate} />
              </div>
              <div className="setting">
                <div className="row" style={{ flexWrap: 'nowrap' }}>
                  <Sparkles size={18} />
                  <div>
                    <div className="setting-title">{t('Fabrika animasyonları', 'Factory animations')}</div>
                    <div className="setting-desc">{t('Panelin kendi demolarına dön', "Return to the panel's built-in demos")}</div>
                  </div>
                </div>
                <button
                  className="btn sm"
                  onClick={async () => {
                    if (await s.run(t('Demolar açılıyor', 'Restoring demos'), (p) => p.commandOk(P.playlistClear())))
                      s.set({ now: { kind: 'mode', label: t('DEMO', 'DEMO') } })
                  }}
                >
                  <RotateCcw size={15} />
                  {t('Dön', 'Restore')}
                </button>
              </div>
            </Card>
          </div>

          <Card title={t('Tek dokunuşla', 'One tap')}>
            <div className="gallery" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
              {['rainbow', 'heart', 'eyes', 'fire', 'hazard', 'plasma'].map((id) => {
                const pr = PRESETS.find((x) => x.id === id)!
                return <PresetMini key={id} id={id} name={pr.name[s.lang]} onClick={() => sendPreset(id)} />
              })}
            </div>
          </Card>

          <div className="feature-grid">
            {FEATURES.map((f) => (
              <button key={f.id} className="feature" onClick={() => go(f.id)}>
                <div className="feature-icon" style={{ background: `${f.color}22`, color: f.color }}>
                  <f.icon size={19} />
                </div>
                <b>{s.lang === 'tr' ? f.tr[0] : f.en[0]}</b>
                <span>{s.lang === 'tr' ? f.tr[1] : f.en[1]}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function PresetMini({ id, name, onClick }: { id: string; name: string; onClick: () => void }) {
  const render = useMemo(() => {
    const pr = PRESETS.find((x) => x.id === id)!
    return framesRenderer(presetFrames(pr))
  }, [id])
  return (
    <button className="gcard" onClick={onClick}>
      <LedMatrix render={render} glow={false} />
      <div className="gcard-name">{name}</div>
    </button>
  )
}
