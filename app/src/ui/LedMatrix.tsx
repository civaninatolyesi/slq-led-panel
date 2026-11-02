import { useEffect, useRef } from 'react'
import { H, W } from '../core/media'
import type { Renderer } from '../core/preview'

interface Props {
  /** Sabit görüntü ya da zamana bağlı çizici. */
  render: Renderer | Uint8ClampedArray | null
  /** Ekrandaki LED çapının adıma oranı. */
  dot?: number
  glow?: boolean
  badge?: string
  className?: string
  onCanvas?: (c: HTMLCanvasElement) => void
  children?: React.ReactNode
}

/**
 * 48x12 LED paneli gerçekçi noktalarla çizer. Çizici yalnızca görüntü değiştiğinde yeniden boyar,
 * ekran dışındayken durur.
 */
export function LedMatrix({ render, dot = 0.78, glow = true, badge, className, onCanvas, children }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const renderRef = useRef(render)
  renderRef.current = render

  useEffect(() => {
    const canvas = ref.current!
    onCanvas?.(canvas)
    const ctx = canvas.getContext('2d')!
    let raf = 0
    let last: Uint8ClampedArray | null = null
    let lastSig = ''
    let visible = true
    const t0 = performance.now()

    const resize = () => {
      const w = canvas.clientWidth || 480
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(((w * H) / W) * dpr)
      last = null
    }

    const lit = document.createElement('canvas')
    const lctx = lit.getContext('2d')!
    const offColor = getComputedStyle(canvas).getPropertyValue('--led-off').trim() || '#1a1d27'

    const draw = (px: Uint8ClampedArray) => {
      const step = canvas.width / W
      const r = (step * dot) / 2
      if (lit.width !== canvas.width || lit.height !== canvas.height) {
        lit.width = canvas.width
        lit.height = canvas.height
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      lctx.clearRect(0, 0, lit.width, lit.height)
      ctx.fillStyle = offColor
      ctx.beginPath()
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 4
          const cx = x * step + step / 2
          const cy = y * step + step / 2
          if (px[i] + px[i + 1] + px[i + 2] < 24) {
            ctx.moveTo(cx + r, cy)
            ctx.arc(cx, cy, r, 0, Math.PI * 2)
          } else {
            lctx.fillStyle = `rgb(${px[i]},${px[i + 1]},${px[i + 2]})`
            lctx.beginPath()
            lctx.arc(cx, cy, r, 0, Math.PI * 2)
            lctx.fill()
          }
        }
      ctx.fill()
      if (glow) {
        // Işıma: yanan LED katmanının bulanık kopyası, üstüne net hali
        ctx.save()
        ctx.filter = `blur(${Math.max(2, step * 0.55)}px)`
        ctx.globalAlpha = 0.85
        ctx.globalCompositeOperation = 'lighter'
        ctx.drawImage(lit, 0, 0)
        ctx.restore()
      }
      ctx.drawImage(lit, 0, 0)
    }

    const same = (a: Uint8ClampedArray, b: Uint8ClampedArray | null) => {
      if (!b || a.length !== b.length) return false
      for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
      return true
    }

    const tick = () => {
      raf = requestAnimationFrame(tick)
      if (!visible) return
      const src = renderRef.current
      const px = src == null ? null : typeof src === 'function' ? src(performance.now() - t0) : src
      if (!px) {
        if (lastSig !== 'empty') {
          draw(new Uint8ClampedArray(W * H * 4))
          lastSig = 'empty'
          last = null
        }
        return
      }
      if (lastSig === '' && same(px, last)) return
      last = px.slice()
      lastSig = ''
      draw(px)
    }

    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting))
    io.observe(canvas)
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dot, glow])

  return (
    <div className={`matrix-wrap ${className ?? ''}`}>
      <canvas ref={ref} />
      {badge && <div className="matrix-badge">{badge}</div>}
      {children}
    </div>
  )
}
