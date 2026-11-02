import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Blinds,
  ListPlus,
  Pause,
  Send,
  Snowflake,
  Zap,
} from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { ConnectHint } from '../App'
import { serializeFrames } from '../core/media'
import { GRADIENTS, VERIFIED_GRADIENTS, textRenderer } from '../core/preview'
import * as P from '../core/protocol'
import { encodeText, rainbow, type GlyphMode } from '../core/text'
import { useStore } from '../state/store'
import { b64 } from '../state/util'
import { Card, ColorPicker, PageHead, Seg, Slider, Switch, toHex, useT } from '../ui/controls'
import { LedMatrix } from '../ui/LedMatrix'

type ColorMode = 'solid' | 'rainbow' | 'gradient'

interface TextPrefs {
  text: string
  colorMode: ColorMode
  color: P.RGB
  gradient: number
  bg: P.RGB
  effect: P.Effect
  speed: number
  glyph: GlyphMode
  vertical: boolean
  live: boolean
  set: (p: Partial<TextPrefs>) => void
}

const useTextPrefs = create<TextPrefs>()(
  persist(
    (set) => ({
      text: 'MERHABA',
      colorMode: 'solid',
      color: [255, 90, 0],
      gradient: 3,
      bg: [0, 0, 0],
      effect: P.Effect.LEFT,
      speed: 60,
      glyph: 'narrow',
      vertical: false,
      live: true,
      set: (p) => set(p),
    }),
    { name: 'slq-text', partialize: ({ set: _s, ...rest }) => rest },
  ),
)

const EFFECTS: { v: P.Effect; icon: typeof Pause; tr: string; en: string }[] = [
  { v: P.Effect.FIXED, icon: Pause, tr: 'Sabit', en: 'Static' },
  { v: P.Effect.LEFT, icon: ArrowLeft, tr: 'Sola kay', en: 'Scroll left' },
  { v: P.Effect.RIGHT, icon: ArrowRight, tr: 'Sağa kay', en: 'Scroll right' },
  { v: P.Effect.UP, icon: ArrowUp, tr: 'Yukarı', en: 'Up' },
  { v: P.Effect.DOWN, icon: ArrowDown, tr: 'Aşağı', en: 'Down' },
  { v: P.Effect.PAGE_5, icon: Snowflake, tr: 'Geçiş A', en: 'Transition A' },
  { v: P.Effect.PAGE_6, icon: Blinds, tr: 'Geçiş B', en: 'Transition B' },
  { v: P.Effect.LASER, icon: Zap, tr: 'Lazer', en: 'Laser' },
]

const SYMBOLS = ['♥', '★', '☺', '♪', '✓', '→', '←', '☀', '⚡', '°']
const TEMPLATES = { tr: ['MERHABA', 'TEŞEKKÜRLER ♥', 'DİKKAT!', 'İYİ YOLCULUKLAR', 'GÜLÜMSE ☺'], en: ['HELLO', 'THANK YOU ♥', 'CAUTION!', 'RIDE SAFE', 'SMILE ☺'] }

const MAX_CHARS = 160

/** Sağa kaymada panel karakter sırasını ters gösterir ("OLLEH"); okunur olması için ters göndeririz. */
const forPanel = (text: string, effect: P.Effect) => (effect === P.Effect.RIGHT ? Array.from(text).reverse().join('') : text)

export default function TextPage() {
  const t = useT()
  const s = useTextPrefs()
  const { panel, run, set: setStore, playlist, toast, lang } = useStore()
  const lastSent = useRef<{ key: string } | null>(null)

  const colorFn = (i: number, n: number): P.RGB => (s.colorMode === 'rainbow' ? rainbow(i, n) : s.color)
  const colorIndex = s.colorMode === 'gradient' ? s.gradient : 0

  const preview = useMemo(() => encodeText(s.text || ' ', colorFn, s.glyph), [s.text, s.colorMode, s.color, s.glyph])
  const render = useMemo(
    () => textRenderer(preview, { effect: s.effect, speed: s.speed, colorIndex, bg: s.bg, vertical: s.vertical }),
    [preview, s.effect, s.speed, colorIndex, s.bg, s.vertical],
  )

  const build = () => {
    const raw = forPanel(s.text, s.effect)
    const n = Array.from(raw).length
    const enc = encodeText(raw, (i) => colorFn(s.effect === P.Effect.RIGHT ? n - 1 - i : i, n), s.glyph)
    const opts: P.TextStart = {
      effect: s.effect,
      speed: s.speed,
      colorIndex,
      bgIndex: 0,
      bgRgb: s.bg,
      orientation: s.vertical ? 1 : 0,
    }
    return { enc, opts }
  }

  // Yazının kendisi değişmeden yalnızca görünüm değiştiyse, panelde 54 01 ile anında uygula.
  const contentKey = `${forPanel(s.text, s.effect)}|${s.glyph}|${s.colorMode === 'rainbow' ? 'rb' : 'solid'}`
  useEffect(() => {
    if (!s.live || !panel || !lastSent.current || lastSent.current.key !== contentKey || s.colorMode === 'rainbow') return
    const h = setTimeout(() => {
      void panel.commandOk(
        P.textStyle({
          effect: s.effect,
          speed: s.speed,
          colorIndex,
          rgb: s.color,
          bgIndex: 0,
          bgRgb: s.bg,
          orientation: s.vertical ? 1 : 0,
        }),
      )
      setStore({ now: { kind: 'text', label: s.text, render } })
    }, 180)
    return () => clearTimeout(h)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.effect, s.speed, s.color, s.gradient, s.colorMode, s.bg, s.vertical])

  const send = async () => {
    if (!s.text.trim()) return
    const { enc, opts } = build()
    const ok = await run(t('Yazı gönderiliyor', 'Sending text'), (p, prog) => p.sendText(enc.data, opts, (d, n) => prog(d / n)))
    if (ok) {
      lastSent.current = { key: contentKey }
      setStore({ now: { kind: 'text', label: s.text, render } })
      toast('ok', t('Yazı panelde', 'Text is on the panel'))
    }
  }

  const addToPlaylist = () => {
    if (!s.text.trim()) return
    const { enc, opts } = build()
    setStore({
      playlist: [
        ...playlist,
        {
          id: crypto.randomUUID(),
          kind: 'text',
          label: s.text,
          data: b64(enc.data),
          opts,
          thumb: serializeFrames([{ px: render(400), delay: 100 }]),
        },
      ],
    })
    toast('ok', t('Playlist\'e eklendi', 'Added to playlist'))
  }

  const chars = Array.from(s.text).length

  return (
    <div className="page">
      <PageHead title={t('Yazı', 'Text')} sub={t('Yaz, renklendir, efekt seç — önizleme paneldeki gibi.', 'Type, colour, pick an effect — the preview matches your panel.')} />
      <div className="split">
        <div className="stack">
          <LedMatrix render={render} badge={t('ÖNİZLEME', 'PREVIEW')} />
          <Card>
            <textarea
              className="input"
              value={s.text}
              maxLength={MAX_CHARS}
              placeholder={t('Panelde görünecek yazı…', 'Text to show on the panel…')}
              onChange={(e) => s.set({ text: e.target.value.replace(/\n/g, ' ') })}
            />
            <div className="row between" style={{ marginTop: 10 }}>
              <div className="row" style={{ gap: 6 }}>
                {SYMBOLS.map((c) => (
                  <button key={c} className="btn sm icon" onClick={() => s.set({ text: s.text + c })}>
                    {c}
                  </button>
                ))}
              </div>
              <span className="faint">
                {chars}/{MAX_CHARS}
              </span>
            </div>
            <div className="row" style={{ gap: 6, marginTop: 10 }}>
              {TEMPLATES[lang].map((x) => (
                <button key={x} className="chip" style={{ border: 0, cursor: 'pointer' }} onClick={() => s.set({ text: x })}>
                  {x}
                </button>
              ))}
            </div>
          </Card>

          <Card title={t('Efekt', 'Effect')}>
            <div className="tile-grid">
              {EFFECTS.map((e) => (
                <button key={e.v} className={`tile ${s.effect === e.v ? 'on' : ''}`} onClick={() => s.set({ effect: e.v })}>
                  <e.icon size={20} />
                  {t(e.tr, e.en)}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 16 }}>
              <Slider label={t('Hız', 'Speed')} value={s.speed} onChange={(v) => s.set({ speed: v })} />
            </div>
          </Card>
        </div>

        <div className="stack">
          <Card title={t('Renk', 'Colour')}>
            <Seg
              value={s.colorMode}
              onChange={(v) => s.set({ colorMode: v })}
              options={[
                { value: 'solid', label: t('Tek renk', 'Solid') },
                { value: 'rainbow', label: t('Gökkuşağı', 'Rainbow') },
                { value: 'gradient', label: t('Gradyan', 'Gradient') },
              ]}
            />
            <div style={{ marginTop: 14 }}>
              {s.colorMode === 'gradient' ? (
                <>
                  <div className="swatches">
                    {Object.entries(GRADIENTS).map(([k, stops]) => (
                      <button
                        key={k}
                        className={`swatch ${s.gradient === Number(k) ? 'on' : ''}`}
                        style={{ background: `linear-gradient(${stops.map(toHex).join(',')})` }}
                        onClick={() => s.set({ gradient: Number(k) })}
                        title={`#${k}`}
                      />
                    ))}
                  </div>
                  {!VERIFIED_GRADIENTS.has(s.gradient) && (
                    <p className="faint" style={{ marginBottom: 0 }}>
                      {t('Bu gradyanın paneldeki görünümü önizlemeden farklı olabilir.', 'This gradient may look different on the panel than in the preview.')}
                    </p>
                  )}
                </>
              ) : s.colorMode === 'solid' ? (
                <ColorPicker value={s.color} onChange={(c) => s.set({ color: c })} />
              ) : (
                <p className="faint" style={{ margin: 0 }}>
                  {t('Her harf farklı renkte. Değiştirmek için yazıyı yeniden gönder.', 'Every letter gets its own colour. Re-send to apply changes.')}
                </p>
              )}
            </div>
            <div className="label" style={{ marginTop: 18 }}>
              {t('Arka plan', 'Background')}
            </div>
            <ColorPicker
              value={s.bg}
              onChange={(c) => s.set({ bg: c })}
              palette={[
                [0, 0, 0],
                [40, 0, 0],
                [0, 30, 0],
                [0, 0, 50],
                [40, 0, 40],
              ]}
            />
          </Card>

          <Card title={t('Yazı biçimi', 'Lettering')}>
            <div className="label">{t('Harf genişliği', 'Letter width')}</div>
            <Seg
              value={s.glyph}
              onChange={(v) => s.set({ glyph: v })}
              options={[
                { value: 'narrow', label: t('Dar (8 harf)', 'Narrow (8 chars)') },
                { value: 'wide', label: t('Geniş (4 harf)', 'Wide (4 chars)') },
              ]}
            />
            <div className="setting" style={{ marginTop: 14 }}>
              <div>
                <div className="setting-title">{t('Dikey yazı', 'Vertical text')}</div>
                <div className="setting-desc">{t('Harfler alt alta', 'Letters stacked')}</div>
              </div>
              <Switch on={s.vertical} onChange={(v) => s.set({ vertical: v })} />
            </div>
            <div className="setting">
              <div>
                <div className="setting-title">{t('Anında uygula', 'Apply instantly')}</div>
                <div className="setting-desc">{t('Gönderilen yazının efekt/renk değişiklikleri panele hemen yansır', 'Effect and colour changes update the panel right away')}</div>
              </div>
              <Switch on={s.live} onChange={(v) => s.set({ live: v })} />
            </div>
          </Card>

          <div className="stack sticky-actions" style={{ gap: 10 }}>
            <ConnectHint />
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <button className="btn primary lg" style={{ flex: 1 }} onClick={send} disabled={!s.text.trim()}>
                <Send size={18} />
                {t('Panele gönder', 'Send to panel')}
              </button>
              <button className="btn lg icon" onClick={addToPlaylist} title={t('Playlist\'e ekle', 'Add to playlist')} disabled={!s.text.trim()}>
                <ListPlus size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
