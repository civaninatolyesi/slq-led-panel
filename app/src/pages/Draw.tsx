import { Eraser, FlipHorizontal2, FlipVertical2, LogOut, Pencil, Play, Sparkles, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { ConnectHint } from '../App'
import { H, W, blankPixels, setPx } from '../core/media'
import * as P from '../core/protocol'
import { useStore } from '../state/store'
import { Card, ColorPicker, PageHead, Seg, useT } from '../ui/controls'
import { PixelCanvas } from '../ui/PixelCanvas'

type Mirror = 'none' | 'h' | 'v'

/**
 * Grafiti modu: her dokunuş tek bir piksel komutu (0C 01) olarak anında panele gider.
 * Ayna modlarında simetriği firmware kendisi çizer; burada yalnızca önizlemesi çizilir.
 */
export default function DrawPage() {
  const t = useT()
  const { panel, run, set, toast } = useStore()
  const [active, setActive] = useState(false)
  const [erase, setErase] = useState(false)
  const [mirror, setMirror] = useState<Mirror>('none')
  const [color, setColor] = useState<P.RGB>([0, 220, 255])
  const [version, setVersion] = useState(0)
  const px = useRef(blankPixels())
  const sent = useRef(new Set<string>())

  const reset = () => {
    px.current = blankPixels()
    sent.current.clear()
    setVersion((v) => v + 1)
  }

  const start = async () => {
    if (await run(t('Çizim modu açılıyor', 'Starting draw mode'), (p) => p.commandOk(P.graffiti(P.GraffitiMode.NEW)))) {
      reset()
      setActive(true)
      set({ now: { kind: 'mode', label: t('ÇİZİM', 'DRAWING') } })
    }
  }

  const exit = async () => {
    setActive(false)
    await panel?.commandOk(P.graffiti(P.GraffitiMode.EXIT))
    set({ now: null })
    toast('info', t('Önceki içeriğe dönüldü', 'Back to the previous content'))
  }

  const paint = (x: number, y: number) => {
    if (!panel) {
      toast('info', t('Önce panele bağlan', 'Connect to a panel first'))
      return
    }
    if (!active) return
    const c: P.RGB = erase ? [0, 0, 0] : color
    const key = `${x},${y},${c.join()}`
    if (sent.current.has(key)) return
    sent.current.add(key)
    const pts: [number, number][] = [[x, y]]
    if (mirror === 'h') pts.push([W - 1 - x, y])
    if (mirror === 'v') pts.push([x, H - 1 - y])
    for (const [a, b] of pts) {
      setPx(px.current, a, b, c)
      sent.current.add(`${a},${b},${c.join()}`)
    }
    setVersion((v) => v + 1)
    const mode = erase ? P.PixelMode.ERASE : mirror === 'h' ? P.PixelMode.MIRROR_H : mirror === 'v' ? P.PixelMode.MIRROR_V : P.PixelMode.DRAW
    void panel.send(P.pixel(x, y, c, mode))
  }

  return (
    <div className="page">
      <PageHead
        title={t('Canlı çizim', 'Live draw')}
        sub={t('Ekrana dokundukça panelde anında belirir.', 'Pixels appear on the panel as you touch.')}
      />
      <div className="split">
        <div className="stack">
          <div style={{ position: 'relative' }}>
            <PixelCanvas px={px.current} version={version} onPaint={paint} />
            {!active && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'grid',
                  placeItems: 'center',
                  background: 'rgba(5,6,10,.6)',
                  borderRadius: 16,
                  backdropFilter: 'blur(2px)',
                }}
              >
                <button className="btn primary lg" onClick={start} disabled={!panel}>
                  <Play size={18} />
                  {t('Çizime başla', 'Start drawing')}
                </button>
              </div>
            )}
          </div>
          <ConnectHint />
          {active && (
            <div className="row">
              <button className="btn" onClick={start}>
                <Trash2 size={16} />
                {t('Temizle', 'Clear')}
              </button>
              <button className="btn" onClick={exit}>
                <LogOut size={16} />
                {t('Çizimden çık', 'Exit drawing')}
              </button>
            </div>
          )}
        </div>
        <div className="stack">
          <Card title={t('Fırça', 'Brush')}>
            <Seg
              value={erase ? 'erase' : 'pen'}
              onChange={(v) => setErase(v === 'erase')}
              options={[
                { value: 'pen', label: <><Pencil size={15} /> {t('Kalem', 'Pen')}</> },
                { value: 'erase', label: <><Eraser size={15} /> {t('Silgi', 'Eraser')}</> },
              ]}
            />
            <div style={{ marginTop: 14 }}>
              <ColorPicker value={color} onChange={(c) => { setColor(c); setErase(false) }} />
            </div>
          </Card>
          <Card title={t('Simetri', 'Symmetry')}>
            <Seg
              value={mirror}
              onChange={setMirror}
              options={[
                { value: 'none', label: t('Yok', 'Off') },
                { value: 'h', label: <><FlipHorizontal2 size={15} /> {t('Yatay', 'Horizontal')}</> },
                { value: 'v', label: <><FlipVertical2 size={15} /> {t('Dikey', 'Vertical')}</> },
              ]}
            />
            <p className="faint" style={{ marginBottom: 0 }}>
              {t('Simetriyi panel kendisi çizer; tek dokunuşla iki piksel.', 'The panel draws the mirrored pixel itself — one touch, two pixels.')}
            </p>
          </Card>
          <div className="notice info">
            <Sparkles size={18} />
            <div>
              {t(
                'İpucu: kalıcı ve animasyonlu çizimler için Görseller → Stüdyo\'yu kullan.',
                'Tip: for animated drawings you can keep, use Images → Studio.',
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
