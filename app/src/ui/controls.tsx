import { X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import type { RGB } from '../core/protocol'
import { useStore } from '../state/store'

/** Satır içi çeviri: t('Türkçe', 'English'). */
export function useT() {
  const lang = useStore((s) => s.lang)
  return (tr: string, en: string) => (lang === 'tr' ? tr : en)
}

export function Seg<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: ReactNode }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="seg" role="tablist">
      {options.map((o) => (
        <button key={String(o.value)} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Slider({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  unit = '',
  onChange,
}: {
  label?: ReactNode
  value: number
  min?: number
  max?: number
  step?: number
  unit?: string
  onChange: (v: number) => void
}) {
  const p = ((value - min) / (max - min)) * 100
  return (
    <div>
      {label && (
        <div className="label">
          <span>{label}</span>
          <b>
            {value}
            {unit}
          </b>
        </div>
      )}
      <input
        className="range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ ['--p' as string]: `${p}%` }}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  )
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return <button className={`switch ${on ? 'on' : ''}`} role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} />
}

export const PALETTE: RGB[] = [
  [255, 255, 255],
  [255, 0, 0],
  [255, 90, 0],
  [255, 200, 0],
  [0, 255, 60],
  [0, 220, 255],
  [0, 80, 255],
  [150, 0, 255],
  [255, 0, 170],
]

export const toHex = (c: RGB) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('')
export const fromHex = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB
const eq = (a: RGB, b: RGB) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2]

export function ColorPicker({ value, onChange, palette = PALETTE, extra }: { value: RGB; onChange: (c: RGB) => void; palette?: RGB[]; extra?: RGB[] }) {
  const all = [...(extra ?? []), ...palette]
  const custom = !all.some((c) => eq(c, value))
  return (
    <div className="swatches">
      {all.map((c) => (
        <button
          key={c.join()}
          className={`swatch ${eq(c, value) ? 'on' : ''}`}
          style={{ background: c.every((v) => v === 0) ? '#000' : toHex(c) }}
          onClick={() => onChange(c)}
          aria-label={toHex(c)}
        />
      ))}
      <label className={`swatch custom ${custom ? 'on' : ''}`} style={custom ? { background: toHex(value) } : undefined} title="Custom">
        <input type="color" value={toHex(value)} onChange={(e) => onChange(fromHex(e.target.value))} />
      </label>
    </div>
  )
}

export function Modal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="row between" style={{ marginBottom: 4 }}>
          <span />
          <button className="btn ghost sm icon" onClick={onClose} aria-label="close">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function PageHead({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1 className="page-title">{title}</h1>
        {sub && <p className="page-sub">{sub}</p>}
      </div>
      {right}
    </div>
  )
}

export function Card({ title, right, children, className, style }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <section className={`card ${className ?? ''}`} style={style}>
      {(title || right) && (
        <h2 className="card-title">
          <span>{title}</span>
          {right}
        </h2>
      )}
      {children}
    </section>
  )
}
