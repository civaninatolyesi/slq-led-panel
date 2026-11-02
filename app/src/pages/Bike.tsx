import { ArrowBigLeft, ArrowBigRight, Bike, Gauge, LocateFixed, Minus, OctagonX, Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ConnectHint } from '../App'
import * as P from '../core/protocol'
import { useStore } from '../state/store'
import { Card, PageHead, Seg, Switch, useT } from '../ui/controls'

const SIGNALS: { v: P.BikeSignal; icon: typeof Bike; tr: string; en: string; color: string; key: string }[] = [
  { v: P.BikeSignal.LEFT, icon: ArrowBigLeft, tr: 'Sol sinyal', en: 'Left signal', color: '#fbbf24', key: '←' },
  { v: P.BikeSignal.RIGHT, icon: ArrowBigRight, tr: 'Sağ sinyal', en: 'Right signal', color: '#fbbf24', key: '→' },
  { v: P.BikeSignal.RIDING, icon: Bike, tr: 'Sürüyorum', en: 'Riding', color: '#34d399', key: '↑' },
  { v: P.BikeSignal.STOPPED, icon: OctagonX, tr: 'Durdum', en: 'Stopped', color: '#f87171', key: '↓' },
]

export default function BikePage() {
  const t = useT()
  const { panel, run, set } = useStore()
  const [active, setActive] = useState<P.BikeSignal | null>(null)
  const [speed, setSpeed] = useState(0)
  const [mph, setMph] = useState(false)
  const [gps, setGps] = useState(false)
  const [gpsErr, setGpsErr] = useState('')
  const watch = useRef<number | null>(null)

  const signal = async (s: P.BikeSignal) => {
    setActive(s)
    const def = SIGNALS.find((x) => x.v === s)!
    if (await run(t(def.tr, def.en), (p) => p.commandOk(P.bikeSignal(s)))) set({ now: { kind: 'mode', label: t(def.tr, def.en).toUpperCase() } })
  }

  const pushSpeed = (v: number) => {
    const clamped = Math.max(0, Math.min(199.9, Math.round(v * 10) / 10))
    setSpeed(clamped)
    panel?.sendLatest('speed', P.bikeSpeed(clamped, mph))
  }

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return
      const map: Record<string, P.BikeSignal> = { ArrowLeft: 0, ArrowRight: 1, ArrowUp: 2, ArrowDown: 3 }
      if (e.key in map) {
        e.preventDefault()
        void signal(map[e.key])
      }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  })

  useEffect(() => {
    if (!gps) return
    if (!navigator.geolocation) {
      setGpsErr(t('Bu cihazda konum yok', 'No location on this device'))
      setGps(false)
      return
    }
    setGpsErr('')
    watch.current = navigator.geolocation.watchPosition(
      (pos) => {
        const ms = pos.coords.speed ?? 0
        pushSpeed(mph ? ms * 2.23694 : ms * 3.6)
      },
      (err) => {
        setGpsErr(err.code === 1 ? t('Konum izni verilmedi', 'Location permission denied') : t('Konum alınamıyor', 'No location fix'))
      },
      { enableHighAccuracy: true, maximumAge: 1000 },
    )
    return () => {
      if (watch.current != null) navigator.geolocation.clearWatch(watch.current)
    }
  }, [gps, mph])

  return (
    <div className="page">
      <PageHead title={t('Bisiklet', 'Bike')} sub={t('Sinyal ver, hızını göster. Büyük düğmeler sürüşte kolay basılsın diye.', 'Signal turns and show your speed. Big buttons, easy to hit while riding.')} />
      <div className="split">
        <div className="stack">
          <div className="grid grid-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
            {SIGNALS.map((s) => (
              <button
                key={s.v}
                className={`big-btn ${active === s.v ? 'on' : ''}`}
                style={active === s.v ? { background: s.color, boxShadow: `0 16px 40px -14px ${s.color}` } : undefined}
                onClick={() => signal(s.v)}
              >
                <s.icon size={38} />
                {t(s.tr, s.en)}
                <span className="kbd" style={active === s.v ? { color: '#111', borderColor: '#0003' } : undefined}>
                  {s.key}
                </span>
              </button>
            ))}
          </div>
          <ConnectHint />
        </div>
        <Card title={<span className="row" style={{ gap: 6 }}><Gauge size={14} /> {t('Hız göstergesi', 'Speedometer')}</span>}>
          <div className="row between" style={{ flexWrap: 'nowrap' }}>
            <button className="btn lg icon" onClick={() => pushSpeed(speed - 1)} disabled={gps}>
              <Minus size={20} />
            </button>
            <div style={{ textAlign: 'center' }}>
              <div className="speedo">{speed.toFixed(1)}</div>
              <div className="muted">{mph ? 'mph' : 'km/h'}</div>
            </div>
            <button className="btn lg icon" onClick={() => pushSpeed(speed + 1)} disabled={gps}>
              <Plus size={20} />
            </button>
          </div>
          <input
            className="range"
            type="range"
            min={0}
            max={80}
            step={0.5}
            value={Math.min(80, speed)}
            disabled={gps}
            style={{ ['--p' as string]: `${(Math.min(80, speed) / 80) * 100}%`, marginTop: 16 }}
            onChange={(e) => pushSpeed(Number(e.target.value))}
          />
          <div className="setting" style={{ marginTop: 10 }}>
            <div className="setting-title">{t('Birim', 'Unit')}</div>
            <div style={{ flex: '0 1 160px' }}>
              <Seg value={mph ? 'mph' : 'kmh'} onChange={(v) => setMph(v === 'mph')} options={[{ value: 'kmh', label: 'km/h' }, { value: 'mph', label: 'mph' }]} />
            </div>
          </div>
          <div className="setting">
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <LocateFixed size={18} />
              <div>
                <div className="setting-title">{t('GPS ile otomatik', 'Automatic via GPS')}</div>
                <div className="setting-desc">{gpsErr || t('Telefonun hızını panele gönderir', "Sends your phone's speed to the panel")}</div>
              </div>
            </div>
            <Switch on={gps} onChange={setGps} />
          </div>
        </Card>
      </div>
    </div>
  )
}
