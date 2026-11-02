import { AlertTriangle, ExternalLink, Globe, Moon, Palette, RotateCcw, Terminal, Unplug } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { LogEntry } from '../ble/panel'
import * as P from '../core/protocol'
import { useStore } from '../state/store'
import { Card, Modal, PageHead, Seg, useT } from '../ui/controls'

export const REPO_URL = import.meta.env.VITE_REPO_URL ?? 'https://github.com/civaninatolyesi/slq-led-panel'
const VERSION = import.meta.env.VITE_APP_VERSION ?? 'dev'

function Console() {
  const t = useT()
  const panel = useStore((s) => s.panel)
  const [lines, setLines] = useState<LogEntry[]>(() => panel?.log.slice(-200) ?? [])
  const [cmd, setCmd] = useState('5a 01 01 01')
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!panel) return
    setLines(panel.log.slice(-200))
    return panel.onLog(() => setLines(panel.log.slice(-200)))
  }, [panel])

  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight })
  }, [lines])

  const send = async () => {
    if (!panel) return
    try {
      const bytes = P.parseHex(cmd)
      if (bytes.length < 3) throw new Error('CMD SUB LEN …')
      // 52 (şifre) ve 57 (panel tipi) paneli kilitleyebilir/bozabilir: docs/protocol/03-commands.md#denenmeyenler
      if (bytes[0] === 0x52 || bytes[0] === 0x57) throw new Error(t('Bu komut güvenlik için engellendi', 'This command is blocked for safety'))
      // Kullanıcı CMD SUB LEN PAYLOAD yazar; CRC otomatik eklenir. OTA kanalı bu yoldan erişilemez.
      const frame = P.frame(bytes[0], bytes[1], bytes.slice(3))
      await panel.raw(frame)
    } catch (e) {
      panel.emit('error', (e as Error).message)
    }
  }

  return (
    <>
      <div className="log" ref={box}>
        {lines.length === 0 && <span className="info">{t('Henüz trafik yok.', 'No traffic yet.')}</span>}
        {lines.map((l, i) => (
          <div key={i} className={l.kind}>
            {new Date(l.t).toLocaleTimeString()} {l.kind === 'tx' ? '>>' : l.kind === 'rx' ? '<<' : '··'} {l.text}
          </div>
        ))}
      </div>
      <div className="row" style={{ marginTop: 10, flexWrap: 'nowrap' }}>
        <input className="input" style={{ fontFamily: 'ui-monospace, monospace' }} value={cmd} onChange={(e) => setCmd(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
        <button className="btn" onClick={send} disabled={!panel}>
          {t('Gönder', 'Send')}
        </button>
      </div>
      <p className="faint" style={{ marginBottom: 0 }}>
        {t('Biçim: CMD SUB LEN PAYLOAD (hex). CRC otomatik eklenir. Ayrıntılar: docs/protocol/03-commands.md', 'Format: CMD SUB LEN PAYLOAD (hex). CRC is appended automatically. See docs/protocol/03-commands.md')}
      </p>
    </>
  )
}

export default function SettingsPage() {
  const t = useT()
  const s = useStore()
  const [confirmReset, setConfirmReset] = useState(false)
  const [dev, setDev] = useState(false)

  return (
    <div className="page">
      <PageHead title={t('Ayarlar', 'Settings')} />
      <div className="split">
        <div className="stack">
          <Card title={t('Uygulama', 'App')}>
            <div className="setting">
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <Globe size={18} />
                <div className="setting-title">{t('Dil', 'Language')}</div>
              </div>
              <div style={{ flex: '1 1 180px', maxWidth: 220 }}>
                <Seg value={s.lang} onChange={(v) => s.set({ lang: v })} options={[{ value: 'tr', label: 'Türkçe' }, { value: 'en', label: 'English' }]} />
              </div>
            </div>
            <div className="setting">
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                {s.theme === 'light' ? <Palette size={18} /> : <Moon size={18} />}
                <div className="setting-title">{t('Tema', 'Theme')}</div>
              </div>
              <div style={{ flex: '1 1 220px', maxWidth: 280 }}>
                <Seg
                  value={s.theme}
                  onChange={(v) => s.set({ theme: v })}
                  options={[
                    { value: 'dark', label: t('Koyu', 'Dark') },
                    { value: 'light', label: t('Açık', 'Light') },
                    { value: 'system', label: t('Sistem', 'System') },
                  ]}
                />
              </div>
            </div>
          </Card>

          <Card title={t('Panel', 'Panel')}>
            <div className="setting">
              <div>
                <div className="setting-title">{s.lastDevice?.name ?? t('Bağlı panel yok', 'No panel connected')}</div>
                <div className="setting-desc">
                  {s.info ? `${t('Yazılım', 'Firmware')} ${s.info.firmware} · ${t('Parlaklık', 'Brightness')} ${s.info.brightness}%` : t('Bağlanınca bilgiler burada görünür', 'Details appear once connected')}
                </div>
              </div>
              {s.panel && (
                <button className="btn sm" onClick={s.disconnect}>
                  <Unplug size={15} /> {t('Kes', 'Disconnect')}
                </button>
              )}
            </div>
            <div className="setting">
              <div>
                <div className="setting-title">{t('Panel ayarlarını sıfırla', 'Reset panel settings')}</div>
                <div className="setting-desc">{t('Parlaklık ve diğer ayarlar fabrika değerine döner', 'Brightness and other settings go back to factory values')}</div>
              </div>
              <button className="btn sm danger" disabled={!s.panel} onClick={() => setConfirmReset(true)}>
                <RotateCcw size={15} /> {t('Sıfırla', 'Reset')}
              </button>
            </div>
          </Card>

          <Card title={t('Hakkında', 'About')}>
            <p style={{ marginTop: 0 }}>
              <b>SLQ Studio</b> <span className="faint">v{VERSION}</span>
            </p>
            <p className="muted">
              {t(
                'SLQ marka 48×12 LED paneller için açık kaynak kontrol uygulaması. Üreticiyle bağlantısı yoktur; protokol, sahip olunan cihazlarla birlikte çalışabilirlik için belgelenmiştir.',
                'Open-source controller for SLQ 48×12 LED panels. Not affiliated with the manufacturer; the protocol was documented for interoperability with devices we own.',
              )}
            </p>
            <div className="row">
              <button className="btn sm" onClick={() => (window.slqDesktop ? window.slqDesktop.openExternal(REPO_URL) : window.open(REPO_URL, '_blank'))}>
                <ExternalLink size={15} /> GitHub
              </button>
            </div>
          </Card>
        </div>

        <Card
          title={<span className="row" style={{ gap: 6 }}><Terminal size={14} /> {t('Geliştirici', 'Developer')}</span>}
          right={
            <button className="btn ghost sm" onClick={() => setDev(!dev)}>
              {dev ? t('Gizle', 'Hide') : t('Göster', 'Show')}
            </button>
          }
        >
          {dev ? <Console /> : <p className="faint" style={{ margin: 0 }}>{t('BLE trafiği ve ham komut konsolu.', 'BLE traffic log and raw command console.')}</p>}
        </Card>
      </div>

      {confirmReset && (
        <Modal onClose={() => setConfirmReset(false)}>
          <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
            <AlertTriangle size={24} style={{ color: 'var(--warn)', flex: 'none' }} />
            <div>
              <h3>{t('Panel sıfırlansın mı?', 'Reset the panel?')}</h3>
              <p className="muted">{t('Panel ayarları fabrika değerlerine döner.', 'Panel settings return to factory values.')}</p>
            </div>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
            <button className="btn ghost" onClick={() => setConfirmReset(false)}>
              {t('Vazgeç', 'Cancel')}
            </button>
            <button
              className="btn danger"
              onClick={async () => {
                setConfirmReset(false)
                if (await s.run(t('Sıfırlanıyor', 'Resetting'), (p) => p.commandOk(P.reset()))) {
                  const info = await s.panel?.queryInfo()
                  s.set({ info: info ?? s.info, ...(info ? { brightness: info.brightness } : {}) })
                  s.toast('ok', t('Panel sıfırlandı', 'Panel reset'))
                }
              }}
            >
              {t('Sıfırla', 'Reset')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
