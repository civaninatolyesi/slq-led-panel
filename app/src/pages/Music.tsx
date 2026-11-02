import { FileAudio, Mic, Monitor, Play, Square } from 'lucide-react'
import { useEffect, useReducer, useRef, useState } from 'react'
import { ConnectHint } from '../App'
import { rhythm, type Source } from '../state/audio'
import { useStore } from '../state/store'
import { Card, PageHead, Slider, useT } from '../ui/controls'

const STYLES = 5

export default function MusicPage() {
  const t = useT()
  const { toast, set } = useStore()
  const [, force] = useReducer((x: number) => x + 1, 0)
  const [source, setSource] = useState<Source>(rhythm.source)
  const fileRef = useRef<HTMLInputElement>(null)
  const canSystem = window.slqDesktop?.platform === 'win32'

  useEffect(() => rhythm.subscribe(force), [])

  const start = async (src: Source, file?: File) => {
    try {
      await rhythm.start(src, file)
      set({ now: { kind: 'mode', label: t('MÜZİK', 'MUSIC') } })
    } catch (e) {
      const name = (e as Error).name
      toast(
        'error',
        name === 'NotAllowedError'
          ? t('Ses izni verilmedi', 'Audio permission was denied')
          : t('Ses kaynağı açılamadı', "Couldn't open the audio source"),
      )
    }
  }

  const sources: { v: Source; icon: typeof Mic; tr: string; en: string; desc: [string, string] }[] = [
    { v: 'mic', icon: Mic, tr: 'Mikrofon', en: 'Microphone', desc: ['Ortamdaki müziği dinler', 'Listens to the music around you'] },
    { v: 'file', icon: FileAudio, tr: 'Müzik dosyası', en: 'Music file', desc: ['Bir şarkı seç ve çal', 'Pick a song and play it'] },
    ...(canSystem
      ? [{ v: 'system' as Source, icon: Monitor, tr: 'Bilgisayar sesi', en: 'System audio', desc: ['Bilgisayarda çalan her şey', 'Anything playing on this PC'] as [string, string] }]
      : []),
  ]

  return (
    <div className="page">
      <PageHead title={t('Müzik ritmi', 'Music')} sub={t('Panel müziğin ritmiyle dans etsin.', 'Let your panel dance to the beat.')} />
      <div className="split">
        <div className="stack">
          <Card>
            <div className="bars">
              {rhythm.bands.map((b, i) => (
                <div key={i} style={{ height: `${(b / 16) * 100}%`, opacity: rhythm.running ? 1 : 0.25 }} />
              ))}
            </div>
            <div className="row between" style={{ marginTop: 18 }}>
              <div>
                <b>{rhythm.running ? t('Çalıyor', 'Live') : t('Durdu', 'Stopped')}</b>
                <div className="faint">{rhythm.running && rhythm.source === 'file' ? rhythm.fileName : t('12 bant · saniyede ~18 güncelleme', '12 bands · ~18 updates per second')}</div>
              </div>
              {rhythm.running ? (
                <button className="btn lg" onClick={() => rhythm.stop().then(() => set({ now: null }))}>
                  <Square size={18} /> {t('Durdur', 'Stop')}
                </button>
              ) : (
                <button className="btn primary lg" onClick={() => (source === 'file' ? fileRef.current?.click() : start(source))}>
                  <Play size={18} /> {t('Başlat', 'Start')}
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="audio/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void start('file', f)
                e.target.value = ''
              }}
            />
          </Card>
          <ConnectHint />
        </div>
        <div className="stack">
          <Card title={t('Ses kaynağı', 'Audio source')}>
            <div className="stack" style={{ gap: 8 }}>
              {sources.map((s) => (
                <button key={s.v} className={`device ${source === s.v ? '' : ''}`} style={source === s.v ? { borderColor: 'var(--accent)', background: 'var(--accent-soft)' } : undefined} onClick={() => setSource(s.v)}>
                  <s.icon size={20} />
                  <div>
                    <div style={{ fontWeight: 600 }}>{t(s.tr, s.en)}</div>
                    <div className="faint">{t(...s.desc)}</div>
                  </div>
                </button>
              ))}
            </div>
          </Card>
          <Card title={t('Görünüm', 'Style')}>
            <div className="tile-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
              {Array.from({ length: STYLES }, (_, i) => (
                <button
                  key={i}
                  className={`tile ${rhythm.style === i ? 'on' : ''}`}
                  onClick={() => {
                    rhythm.style = i
                    force()
                  }}
                >
                  <StyleIcon i={i} />
                  {i + 1}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 16 }}>
              <Slider
                label={t('Hassasiyet', 'Sensitivity')}
                value={Math.round(rhythm.sensitivity * 100)}
                min={40}
                max={250}
                unit="%"
                onChange={(v) => {
                  rhythm.sensitivity = v / 100
                  force()
                }}
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

function StyleIcon({ i }: { i: number }) {
  const h = [
    [3, 6, 9, 6, 3],
    [9, 6, 3, 6, 9],
    [5, 8, 5, 8, 5],
    [2, 4, 6, 8, 10],
    [7, 3, 9, 4, 8],
  ][i]
  return (
    <svg width="26" height="16" viewBox="0 0 26 16">
      {h.map((v, k) => (
        <rect key={k} x={k * 5 + 1} y={i === 1 ? 0 : 16 - v * 1.5} width="3.5" height={v * 1.5} rx="1" fill="currentColor" />
      ))}
    </svg>
  )
}
