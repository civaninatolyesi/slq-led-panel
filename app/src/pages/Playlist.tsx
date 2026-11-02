import { ArrowDown, ArrowUp, Image, ListMusic, RotateCcw, Trash2, Type, Upload } from 'lucide-react'
import { useMemo } from 'react'
import type { PageId } from '../App'
import { ConnectHint } from '../App'
import { deserializeFrames } from '../core/media'
import { framesRenderer } from '../core/preview'
import * as P from '../core/protocol'
import { useStore, type PlaylistItem } from '../state/store'
import { unb64 } from '../state/util'
import { Card, PageHead, useT } from '../ui/controls'
import { LedMatrix } from '../ui/LedMatrix'

const MAX_ITEMS = 20

function Thumb({ item }: { item: PlaylistItem }) {
  const render = useMemo(() => framesRenderer(deserializeFrames(item.thumb)), [item.thumb])
  return <LedMatrix render={render} glow={false} dot={0.85} />
}

export default function PlaylistPage({ go }: { go: (p: PageId) => void }) {
  const t = useT()
  const { playlist, set, run, toast } = useStore()

  const move = (i: number, d: number) => {
    const next = [...playlist]
    const [x] = next.splice(i, 1)
    next.splice(i + d, 0, x)
    set({ playlist: next })
  }

  const upload = async () => {
    const items = playlist.slice(0, MAX_ITEMS).map((it) =>
      it.kind === 'gif' ? { kind: 'gif' as const, data: unb64(it.data) } : { kind: 'text' as const, data: unb64(it.data), opts: it.opts ?? {} },
    )
    const ok = await run(t('Playlist yükleniyor', 'Uploading playlist'), (p, prog) =>
      p.sendPlaylist(items, (k, f) => prog((k + f) / items.length)),
    )
    if (ok) {
      set({ now: { kind: 'frames', frames: deserializeFrames(playlist[0].thumb), label: 'playlist' } })
      toast('ok', t('Playlist panelde dönüyor', 'Playlist is running on the panel'))
    }
  }

  return (
    <div className="page">
      <PageHead
        title={t('Playlist', 'Playlist')}
        sub={t('Yazı ve görselleri sıraya koy; panel kendi kendine sırayla oynatır.', 'Queue texts and images; the panel cycles through them on its own.')}
      />
      <div className="split">
        <Card title={`${playlist.length} ${t('öğe', 'items')}`} right={playlist.length > 0 && (
          <button className="btn ghost sm" onClick={() => set({ playlist: [] })}>
            <Trash2 size={14} /> {t('Listeyi boşalt', 'Clear list')}
          </button>
        )}>
          {playlist.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 10px' }}>
              <ListMusic size={36} style={{ color: 'var(--text-3)' }} />
              <p className="muted">
                {t('Henüz öğe yok. Yazı ya da Görseller sayfasındaki', 'Nothing here yet. Use the')} <b>＋</b>{' '}
                {t("düğmesiyle playlist'e ekle.", 'button on the Text or Images page to add items.')}
              </p>
              <div className="row" style={{ justifyContent: 'center' }}>
                <button className="btn" onClick={() => go('text')}>
                  <Type size={16} /> {t('Yazı ekle', 'Add text')}
                </button>
                <button className="btn" onClick={() => go('media')}>
                  <Image size={16} /> {t('Görsel ekle', 'Add image')}
                </button>
              </div>
            </div>
          ) : (
            <div className="stack" style={{ gap: 8 }}>
              {playlist.map((it, i) => (
                <div key={it.id} className="list-item" style={i >= MAX_ITEMS ? { opacity: 0.4 } : undefined}>
                  <span className="faint" style={{ width: 18, textAlign: 'right' }}>{i + 1}</span>
                  <Thumb item={it} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.label}</div>
                    <div className="faint">{it.kind === 'gif' ? t('Görsel', 'Image') : t('Yazı', 'Text')}</div>
                  </div>
                  <button className="btn sm icon ghost" disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp size={16} />
                  </button>
                  <button className="btn sm icon ghost" disabled={i === playlist.length - 1} onClick={() => move(i, 1)}>
                    <ArrowDown size={16} />
                  </button>
                  <button className="btn sm icon ghost" onClick={() => set({ playlist: playlist.filter((x) => x.id !== it.id) })}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              {playlist.length > MAX_ITEMS && (
                <p className="faint">{t(`İlk ${MAX_ITEMS} öğe yüklenir.`, `Only the first ${MAX_ITEMS} items are uploaded.`)}</p>
              )}
            </div>
          )}
        </Card>
        <div className="stack">
          <Card title={t('Panele yükle', 'Upload')}>
            <p className="muted" style={{ marginTop: 0 }}>
              {t(
                'Playlist yüklenince panel öğeler arasında kendisi geçiş yapar; telefon/bilgisayar bağlı kalmak zorunda değil.',
                "Once uploaded, the panel switches between items by itself — your phone or PC doesn't need to stay connected.",
              )}
            </p>
            <button className="btn primary lg block" disabled={!playlist.length} onClick={upload}>
              <Upload size={18} /> {t('Playlist\'i yükle', 'Upload playlist')}
            </button>
            <button
              className="btn block"
              style={{ marginTop: 10 }}
              onClick={async () => {
                if (await run(t('Temizleniyor', 'Clearing'), (p) => p.commandOk(P.playlistClear())))
                  set({ now: { kind: 'mode', label: 'DEMO' } })
              }}
            >
              <RotateCcw size={16} /> {t('Paneldeki listeyi sil (demolara dön)', 'Clear panel list (back to demos)')}
            </button>
          </Card>
          <ConnectHint />
        </div>
      </div>
    </div>
  )
}
