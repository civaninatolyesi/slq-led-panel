import { AlarmClock, Clock3, Heart, Moon, Power, Rows3, Sparkles, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { ConnectHint } from '../App'
import * as P from '../core/protocol'
import { useStore } from '../state/store'
import { Card, PageHead, Switch, useT } from '../ui/controls'

const STYLES: { icon: typeof Clock3; tr: [string, string]; en: [string, string] }[] = [
  { icon: Heart, tr: ['Kalpli', 'Saat ve dakika, kalplerle'], en: ['Hearts', 'Hours and minutes with hearts'] },
  { icon: Rows3, tr: ['Sade', 'Saat ve dakika alt alta'], en: ['Simple', 'Hours above minutes'] },
  { icon: Sparkles, tr: ['Animasyonlu', 'Solda hareketli süs'], en: ['Animated', 'Animated decoration on the left'] },
  { icon: Clock3, tr: ['Klasik', 'Panelin dördüncü tasarımı'], en: ['Classic', "The panel's fourth design"] },
]

interface Sched {
  onEnabled: boolean
  on: string
  offEnabled: boolean
  off: string
  set: (p: Partial<Sched>) => void
}

const useSched = create<Sched>()(
  persist(
    (set) => ({ onEnabled: false, on: '07:30', offEnabled: true, off: '23:30', set: (p) => set(p) }),
    { name: 'slq-schedule', partialize: ({ set: _s, ...r }) => r },
  ),
)

const hm = (s: string): P.HM => s.split(':').map(Number) as P.HM

export default function ClockPage() {
  const t = useT()
  const { run, set, toast } = useStore()
  const sc = useSched()
  const [style, setStyle] = useState(1)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const h = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(h)
  }, [])

  const showClock = async (i: number) => {
    setStyle(i)
    if (await run(t('Saat gösteriliyor', 'Showing clock'), (p) => p.commandOk(P.clock(i, new Date())))) set({ now: { kind: 'mode', label: t('SAAT', 'CLOCK') } })
  }

  const saveSchedule = async () => {
    const ok = await run(t('Zamanlayıcı kaydediliyor', 'Saving schedule'), (p) =>
      p.commandOk(P.schedule(sc.onEnabled ? hm(sc.on) : null, sc.offEnabled ? hm(sc.off) : null, new Date())),
    )
    if (ok) toast('ok', sc.onEnabled || sc.offEnabled ? t('Zamanlayıcı kuruldu', 'Schedule saved') : t('Zamanlayıcı kapatıldı', 'Schedule turned off'))
  }

  return (
    <div className="page">
      <PageHead title={t('Saat ve zamanlayıcı', 'Clock & timer')} sub={t('Panel saati kendisi tutar; saat bu cihazdan ayarlanır.', 'The panel keeps time itself; it is set from this device.')} />
      <div className="split">
        <Card title={t('Saat göstergesi', 'Clock display')} right={<span className="chip">{now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>}>
          <div className="grid grid-2">
            {STYLES.map((s, i) => (
              <button key={i} className={`tile ${style === i ? 'on' : ''}`} style={{ alignItems: 'flex-start', padding: 16, textAlign: 'left' }} onClick={() => showClock(i)}>
                <s.icon size={22} />
                <span style={{ color: 'var(--text)', fontSize: 14 }}>{t(s.tr[0], s.en[0])}</span>
                <span className="faint" style={{ fontWeight: 400 }}>{t(s.tr[1], s.en[1])}</span>
              </button>
            ))}
          </div>
          <p className="faint" style={{ marginBottom: 0 }}>
            {t('Bir tasarıma dokun: panel saati bu cihazın saatiyle eşitlenir ve gösterilir.', "Tap a design: the panel's clock syncs to this device and is shown.")}
          </p>
        </Card>

        <div className="stack">
          <Card title={<span className="row" style={{ gap: 6 }}><AlarmClock size={14} /> {t('Otomatik aç / kapa', 'Auto on / off')}</span>}>
            <div className="setting">
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <Sun size={18} />
                <div>
                  <div className="setting-title">{t('Her gün açıl', 'Turn on daily')}</div>
                  <input className="input" type="time" value={sc.on} disabled={!sc.onEnabled} onChange={(e) => sc.set({ on: e.target.value })} style={{ marginTop: 6 }} />
                </div>
              </div>
              <Switch on={sc.onEnabled} onChange={(v) => sc.set({ onEnabled: v })} />
            </div>
            <div className="setting">
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <Moon size={18} />
                <div>
                  <div className="setting-title">{t('Her gün kapan', 'Turn off daily')}</div>
                  <input className="input" type="time" value={sc.off} disabled={!sc.offEnabled} onChange={(e) => sc.set({ off: e.target.value })} style={{ marginTop: 6 }} />
                </div>
              </div>
              <Switch on={sc.offEnabled} onChange={(v) => sc.set({ offEnabled: v })} />
            </div>
            <button className="btn primary block lg" style={{ marginTop: 16 }} onClick={saveSchedule}>
              <Power size={18} />
              {sc.onEnabled || sc.offEnabled ? t('Zamanlayıcıyı kaydet', 'Save schedule') : t('Zamanlayıcıyı kapat', 'Turn schedule off')}
            </button>
          </Card>
          <ConnectHint />
        </div>
      </div>
    </div>
  )
}
