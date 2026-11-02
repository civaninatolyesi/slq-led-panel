import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Copy,
  Download,
  Eraser,
  Eye,
  EyeOff,
  FileImage,
  Layers,
  ListPlus,
  PaintBucket,
  Pencil,
  Pipette,
  Plus,
  Send,
  Trash2,
  Upload,
  Wand2,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { ConnectHint } from '../App'
import { isNative } from '../ble/transport'
import { PRESETS, presetFrames, type Preset } from '../core/animations'
import {
  H,
  W,
  cloneFrames,
  decodeImageFile,
  deserializeFrames,
  encodeGif,
  getPx,
  makeFrame,
  serializeFrames,
  setPx,
  type Fit,
  type Frame,
} from '../core/media'
import { framesRenderer } from '../core/preview'
import type { RGB } from '../core/protocol'
import { useStore } from '../state/store'
import { b64, download } from '../state/util'
import { Card, ColorPicker, PageHead, Seg, Slider, useT } from '../ui/controls'
import { LedMatrix } from '../ui/LedMatrix'
import { PixelCanvas } from '../ui/PixelCanvas'

type Tab = 'gallery' | 'file' | 'studio'

// ---------------------------------------------------------------- stüdyo durumu (kalıcı)
interface StudioState {
  data: string
  setFrames: (f: Frame[]) => void
}
const useStudio = create<StudioState>()(
  persist(
    (set) => ({
      data: '',
      setFrames: (f) => set({ data: serializeFrames(f) }),
    }),
    { name: 'slq-studio-frames' },
  ),
)

let tabMemory: Tab = 'gallery'

// ---------------------------------------------------------------- ortak gönder çubuğu
function Actions({ frames, original, label, onEdit }: { frames: Frame[]; original?: Uint8Array; label: string; onEdit?: () => void }) {
  const t = useT()
  const { run, set, playlist, toast } = useStore()
  const gif = () => original ?? encodeGif(frames)

  const send = async () => {
    const data = gif()
    const ok = await run(t('Görsel gönderiliyor', 'Sending image'), (p, prog) => p.sendGif(data, 0, (d, n) => prog(d / n)))
    if (ok) {
      set({ now: { kind: 'frames', frames, label } })
      toast('ok', t('Panelde', 'On the panel'))
    }
  }

  const add = () => {
    set({
      playlist: [
        ...playlist,
        { id: crypto.randomUUID(), kind: 'gif', label, data: b64(gif()), thumb: serializeFrames(frames.slice(0, 40)) },
      ],
    })
    toast('ok', t("Playlist'e eklendi", 'Added to playlist'))
  }

  const size = useMemo(() => gif().length, [frames, original])

  return (
    <div className="stack" style={{ gap: 10 }}>
      <ConnectHint />
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <button className="btn primary lg" style={{ flex: 1 }} onClick={send}>
          <Send size={18} />
          {t('Panele gönder', 'Send to panel')}
        </button>
        <button className="btn lg icon" onClick={add} title={t("Playlist'e ekle", 'Add to playlist')}>
          <ListPlus size={20} />
        </button>
        {onEdit && (
          <button className="btn lg icon" onClick={onEdit} title={t('Stüdyoda düzenle', 'Edit in studio')}>
            <Wand2 size={20} />
          </button>
        )}
        {!isNative() && <button className="btn lg icon" onClick={() => download(`${label.replace(/\W+/g, '_') || 'slq'}.gif`, gif())} title={t('GIF indir', 'Download GIF')}>
          <Download size={20} />
        </button>}
      </div>
      <div className="faint">
        {frames.length} {t('kare', 'frames')} · {(size / 1024).toFixed(1)} KB · ~{Math.max(1, Math.ceil(size / 446))} {t('parça', 'chunks')}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- galeri
function PresetCard({ p, on, color, onClick }: { p: Preset; on: boolean; color?: RGB; onClick: () => void }) {
  const lang = useStore((s) => s.lang)
  const render = useMemo(() => framesRenderer(presetFrames(p, color)), [p, color])
  return (
    <button className={`gcard ${on ? 'on' : ''}`} onClick={onClick}>
      <LedMatrix render={render} glow={false} dot={0.82} />
      <div className="gcard-name">{p.name[lang]}</div>
    </button>
  )
}

function Gallery({ toStudio }: { toStudio: (f: Frame[]) => void }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const [sel, setSel] = useState(PRESETS[0].id)
  const [colors, setColors] = useState<Record<string, RGB>>({})
  const [tag, setTag] = useState<'all' | Preset['tags'][number]>('all')
  const p = PRESETS.find((x) => x.id === sel)!
  const color = colors[sel] ?? p.color
  const frames = useMemo(() => presetFrames(p, color), [p, color])
  const render = useMemo(() => framesRenderer(frames), [frames])

  const tags: { value: typeof tag; label: string }[] = [
    { value: 'all', label: t('Tümü', 'All') },
    { value: 'fun', label: t('Eğlence', 'Fun') },
    { value: 'ride', label: t('Sürüş', 'Ride') },
    { value: 'party', label: t('Parti', 'Party') },
    { value: 'ambient', label: t('Ortam', 'Ambient') },
  ]

  return (
    <div className="split">
      <Card>
        <div style={{ marginBottom: 14 }}>
          <Seg value={tag} onChange={setTag} options={tags} />
        </div>
        <div className="gallery">
          {PRESETS.filter((x) => tag === 'all' || x.tags.includes(tag)).map((x) => (
            <PresetCard key={x.id} p={x} on={x.id === sel} color={colors[x.id]} onClick={() => setSel(x.id)} />
          ))}
        </div>
      </Card>
      <div className="stack detail-first">
        <LedMatrix render={render} badge={p.name[lang].toUpperCase()} />
        {p.color && (
          <Card title={t('Renk', 'Colour')}>
            <ColorPicker value={color!} onChange={(c) => setColors({ ...colors, [sel]: c })} />
          </Card>
        )}
        <Actions frames={frames} label={p.name[lang]} onEdit={() => toStudio(cloneFrames(frames))} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- dosyadan
function FromFile({ toStudio }: { toStudio: (f: Frame[]) => void }) {
  const t = useT()
  const toast = useStore((s) => s.toast)
  const [file, setFile] = useState<File | null>(null)
  const [fit, setFit] = useState<Fit>('contain')
  const [res, setRes] = useState<{ frames: Frame[]; original?: Uint8Array } | null>(null)
  const [over, setOver] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!file) return
    decodeImageFile(file, fit)
      .then(setRes)
      .catch(() => toast('error', t('Bu dosya açılamadı', "Couldn't open this file")))
  }, [file, fit])

  const render = useMemo(() => (res ? framesRenderer(res.frames) : null), [res])

  return (
    <div className="split">
      <div className="stack">
        <div
          className={`drop ${over ? 'over' : ''}`}
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setOver(true)
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setOver(false)
            const f = e.dataTransfer.files[0]
            if (f) setFile(f)
          }}
        >
          <Upload size={30} style={{ color: 'var(--accent)' }} />
          <div style={{ fontWeight: 700, marginTop: 8, color: 'var(--text)' }}>{t('Resim ya da GIF seç', 'Choose an image or GIF')}</div>
          <div className="faint">{t('veya buraya sürükle · PNG, JPG, GIF, WebP (animasyonlu dahil)', 'or drop it here · PNG, JPG, GIF, WebP (animated too)')}</div>
          <input
            ref={input}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) setFile(f)
              e.target.value = ''
            }}
          />
        </div>
        {file && (
          <Card title={t('Sığdırma', 'Fit')}>
            <Seg
              value={fit}
              onChange={setFit}
              options={[
                { value: 'contain', label: t('Tamamı görünsün', 'Fit') },
                { value: 'cover', label: t('Doldur', 'Fill') },
                { value: 'stretch', label: t('Uzat', 'Stretch') },
              ]}
            />
            {res?.original && fit === 'contain' && (
              <p className="faint" style={{ marginBottom: 0 }}>
                {t('Dosya zaten 48×12 GIF; olduğu gibi gönderilecek.', 'The file is already a 48×12 GIF and will be sent as is.')}
              </p>
            )}
          </Card>
        )}
      </div>
      <div className="stack">
        <LedMatrix render={render} badge={file?.name.slice(0, 24)}>
          {!res && (
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'rgba(255,255,255,.45)', fontSize: 13 }}>
              <span className="row">
                <FileImage size={16} /> {t('Önizleme', 'Preview')}
              </span>
            </div>
          )}
        </LedMatrix>
        {res && (
          <Actions
            frames={res.frames}
            original={fit === 'contain' ? res.original : undefined}
            label={file?.name.replace(/\.\w+$/, '') ?? 'image'}
            onEdit={() => toStudio(cloneFrames(res.frames))}
          />
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- stüdyo
type Tool = 'pen' | 'eraser' | 'fill' | 'pick'

function Studio({ initial }: { initial: Frame[] | null }) {
  const t = useT()
  const { data, setFrames } = useStudio()
  const [frames, setLocal] = useState<Frame[]>(() => {
    if (initial?.length) return initial
    const f = data ? deserializeFrames(data) : []
    return f.length ? f : [makeFrame(150)]
  })
  const [cur, setCur] = useState(0)
  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState<RGB>([255, 0, 120])
  const [onion, setOnion] = useState(true)
  const [version, setVersion] = useState(0)
  const [delay, setDelay] = useState(frames[0]?.delay ?? 150)

  const commit = (next: Frame[] = frames) => {
    setLocal([...next])
    setVersion((v) => v + 1)
    setFrames(next)
  }

  useEffect(() => {
    if (initial?.length) setFrames(initial)
  }, [])

  const f = frames[Math.min(cur, frames.length - 1)]

  const paint = (x: number, y: number) => {
    if (tool === 'pick') {
      setColor(getPx(f.px, x, y))
      setTool('pen')
      return
    }
    if (tool === 'fill') {
      const target = getPx(f.px, x, y).join()
      if (target === color.join()) return
      const stack = [[x, y]]
      while (stack.length) {
        const [a, b] = stack.pop()!
        if (a < 0 || b < 0 || a >= W || b >= H || getPx(f.px, a, b).join() !== target) continue
        setPx(f.px, a, b, color)
        stack.push([a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1])
      }
    } else setPx(f.px, x, y, tool === 'eraser' ? [0, 0, 0] : color)
    setVersion((v) => v + 1)
  }

  const shift = (dx: number, dy: number) => {
    const src = new Uint8ClampedArray(f.px)
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) setPx(f.px, x, y, getPx(src, (x - dx + W) % W, (y - dy + H) % H))
    commit()
  }

  const ops = {
    add: () => {
      const next = [...frames]
      next.splice(cur + 1, 0, makeFrame(delay))
      commit(next)
      setCur(cur + 1)
    },
    dup: () => {
      const next = [...frames]
      next.splice(cur + 1, 0, { px: new Uint8ClampedArray(f.px), delay: f.delay })
      commit(next)
      setCur(cur + 1)
    },
    del: () => {
      if (frames.length === 1) {
        f.px.fill(0)
        commit()
        return
      }
      const next = frames.filter((_, i) => i !== cur)
      commit(next)
      setCur(Math.max(0, cur - 1))
    },
    clear: () => {
      for (let i = 0; i < W * H; i++) f.px.set([0, 0, 0, 255], i * 4)
      commit()
    },
  }

  const render = useMemo(() => framesRenderer(frames.map((x) => ({ px: x.px, delay }))), [frames, version, delay])

  const tools: { v: Tool; icon: typeof Pencil; tr: string; en: string }[] = [
    { v: 'pen', icon: Pencil, tr: 'Kalem', en: 'Pen' },
    { v: 'eraser', icon: Eraser, tr: 'Silgi', en: 'Eraser' },
    { v: 'fill', icon: PaintBucket, tr: 'Doldur', en: 'Fill' },
    { v: 'pick', icon: Pipette, tr: 'Renk al', en: 'Pick' },
  ]

  return (
    <div className="stack">
      <div className="split">
        <div className="stack">
          <PixelCanvas
            px={f.px}
            version={version}
            onion={onion && cur > 0 ? frames[cur - 1].px : null}
            onPaint={(x, y) => paint(x, y)}
            onEnd={() => commit()}
          />
          <div className="frames">
            {frames.map((x, i) => (
              <button key={i} className={`fthumb ${i === cur ? 'on' : ''}`} onClick={() => setCur(i)}>
                <LedMatrix render={x.px} glow={false} dot={0.9} className="" />
                <span>{i + 1}</span>
              </button>
            ))}
          </div>
          <div className="row">
            <button className="btn sm" onClick={ops.add}>
              <Plus size={15} /> {t('Kare', 'Frame')}
            </button>
            <button className="btn sm" onClick={ops.dup}>
              <Copy size={15} /> {t('Çoğalt', 'Duplicate')}
            </button>
            <button className="btn sm" onClick={ops.del}>
              <Trash2 size={15} /> {t('Sil', 'Delete')}
            </button>
            <button className="btn sm" onClick={() => setOnion(!onion)}>
              {onion ? <Eye size={15} /> : <EyeOff size={15} />} {t('Önceki kare', 'Onion skin')}
            </button>
            <span style={{ flex: 1 }} />
            <button className="btn sm danger" onClick={ops.clear}>
              {t('Kareyi temizle', 'Clear frame')}
            </button>
          </div>
        </div>
        <div className="stack">
          <Card title={t('Araç', 'Tool')}>
            <div className="tile-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
              {tools.map((x) => (
                <button key={x.v} className={`tile ${tool === x.v ? 'on' : ''}`} onClick={() => setTool(x.v)}>
                  <x.icon size={19} />
                  {t(x.tr, x.en)}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 14 }}>
              <ColorPicker value={color} onChange={(c) => { setColor(c); if (tool === 'eraser' || tool === 'pick') setTool('pen') }} />
            </div>
            <div className="label" style={{ marginTop: 16 }}>
              {t('Kareyi kaydır', 'Shift frame')}
            </div>
            <div className="row">
              <button className="btn sm icon" onClick={() => shift(-1, 0)}><ArrowLeft size={16} /></button>
              <button className="btn sm icon" onClick={() => shift(1, 0)}><ArrowRight size={16} /></button>
              <button className="btn sm icon" onClick={() => shift(0, -1)}><ArrowUp size={16} /></button>
              <button className="btn sm icon" onClick={() => shift(0, 1)}><ArrowDown size={16} /></button>
            </div>
          </Card>
          <Card title={<span className="row" style={{ gap: 6 }}><Layers size={14} /> {t('Animasyon', 'Animation')}</span>}>
            <LedMatrix render={render} glow={false} />
            <div style={{ marginTop: 12 }}>
              <Slider label={t('Kare süresi', 'Frame time')} value={delay} min={40} max={1000} step={10} unit=" ms" onChange={setDelay} />
            </div>
          </Card>
        </div>
      </div>
      <Actions frames={frames.map((x) => ({ px: x.px, delay }))} label={t('Çizimim', 'My drawing')} />
    </div>
  )
}

export default function MediaPage() {
  const t = useT()
  const [tab, setTabState] = useState<Tab>(tabMemory)
  const [studioInit, setStudioInit] = useState<Frame[] | null>(null)
  const setTab = (x: Tab) => {
    tabMemory = x
    setTabState(x)
  }
  const toStudio = (f: Frame[]) => {
    setStudioInit(f)
    setTab('studio')
  }
  return (
    <div className="page">
      <PageHead
        title={t('Görseller', 'Images')}
        sub={t('Hazır animasyonlar, kendi resimlerin ve piksel çizimlerin.', 'Ready-made animations, your own pictures and pixel art.')}
        right={
          <div style={{ minWidth: 'min(300px, 100%)' }}>
            <Seg
              value={tab}
              onChange={setTab}
              options={[
                { value: 'gallery', label: t('Galeri', 'Gallery') },
                { value: 'file', label: t('Dosyadan', 'From file') },
                { value: 'studio', label: t('Stüdyo', 'Studio') },
              ]}
            />
          </div>
        }
      />
      {tab === 'gallery' && <Gallery toStudio={toStudio} />}
      {tab === 'file' && <FromFile toStudio={toStudio} />}
      {tab === 'studio' && <Studio key={studioInit ? 'init' : 'saved'} initial={studioInit} />}
    </div>
  )
}
