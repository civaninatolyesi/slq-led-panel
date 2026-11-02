import { useEffect, useRef } from 'react'
import { H, W } from '../core/media'

interface Props {
  px: Uint8ClampedArray
  /** Değişiklikten sonra yeniden çizmek için artırılan sayaç. */
  version: number
  onion?: Uint8ClampedArray | null
  /** Sürükleme sırasında her yeni hücre için çağrılır. first = basış anı. */
  onPaint: (x: number, y: number, first: boolean) => void
  onEnd?: () => void
}

/** Düzenlenebilir 48x12 ızgara (fare, dokunmatik ve kalem). */
export function PixelCanvas({ px, version, onion, onPaint, onEnd }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const last = useRef<string | null>(null)

  useEffect(() => {
    const c = ref.current!
    const draw = () => {
      const w = c.clientWidth
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      c.width = Math.round(w * dpr)
      c.height = Math.round(((w * H) / W) * dpr)
      const ctx = c.getContext('2d')!
      const s = c.width / W
      ctx.fillStyle = '#06070a'
      ctx.fillRect(0, 0, c.width, c.height)
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 4
          const lit = px[i] + px[i + 1] + px[i + 2] > 0
          if (lit) ctx.fillStyle = `rgb(${px[i]},${px[i + 1]},${px[i + 2]})`
          else if (onion && onion[i] + onion[i + 1] + onion[i + 2] > 0)
            ctx.fillStyle = `rgba(${onion[i]},${onion[i + 1]},${onion[i + 2]},0.22)`
          else ctx.fillStyle = '#161922'
          const g = Math.max(1, s * 0.08)
          ctx.beginPath()
          ctx.roundRect(x * s + g, y * s + g, s - 2 * g, s - 2 * g, s * 0.22)
          ctx.fill()
        }
      // 8 sütunda bir kılavuz (dar harf genişliği 6, panel ortası 24)
      ctx.strokeStyle = 'rgba(139,92,246,0.35)'
      ctx.lineWidth = Math.max(1, s * 0.06)
      ctx.beginPath()
      ctx.moveTo(24 * s, 0)
      ctx.lineTo(24 * s, c.height)
      ctx.moveTo(0, 6 * s)
      ctx.lineTo(c.width, 6 * s)
      ctx.stroke()
    }
    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(c)
    return () => ro.disconnect()
  }, [px, version, onion])

  const cell = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect()
    const x = Math.floor(((e.clientX - r.left) / r.width) * W)
    const y = Math.floor(((e.clientY - r.top) / r.height) * H)
    return x >= 0 && y >= 0 && x < W && y < H ? [x, y] : null
  }

  return (
    <div className="matrix-wrap" style={{ padding: 8 }}>
      <canvas
        ref={ref}
        className="editor-canvas"
        style={{ width: '100%', display: 'block' }}
        onPointerDown={(e) => {
          ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
          const p = cell(e)
          if (!p) return
          last.current = p.join()
          onPaint(p[0], p[1], true)
        }}
        onPointerMove={(e) => {
          if (!last.current) return
          const p = cell(e)
          if (!p || p.join() === last.current) return
          // Hızlı sürüklemede atlanan hücreleri doldur (Bresenham)
          let [x0, y0] = last.current.split(',').map(Number)
          const [x1, y1] = p
          const dx = Math.abs(x1 - x0)
          const dy = -Math.abs(y1 - y0)
          const sx = x0 < x1 ? 1 : -1
          const sy = y0 < y1 ? 1 : -1
          let err = dx + dy
          while (x0 !== x1 || y0 !== y1) {
            const e2 = 2 * err
            if (e2 >= dy) {
              err += dy
              x0 += sx
            }
            if (e2 <= dx) {
              err += dx
              y0 += sy
            }
            onPaint(x0, y0, false)
          }
          last.current = p.join()
        }}
        onPointerUp={() => {
          last.current = null
          onEnd?.()
        }}
        onPointerCancel={() => {
          last.current = null
          onEnd?.()
        }}
      />
    </div>
  )
}
