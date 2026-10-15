import { cumulative } from './counts'
import { BANDS, type Rings } from './types'

/** Round up to 1, 2, 2.5, 5 or 10 × 10ⁿ. */
export function niceStep(x: number): number {
  if (x <= 0) return 1
  const p = 10 ** Math.floor(Math.log10(x))
  const m = x / p
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p
}

export const tickLabel = (v: number) => (v >= 1000 ? `${v / 1000}k` : String(v))

export interface WaterfallBar {
  label: string
  from: number
  to: number
  value: number
  /** Band index, or null for the Total bar. */
  band: number | null
}

export function waterfall(rings: Rings): { bars: WaterfallBar[]; top: number; ticks: number[] } {
  const cum = cumulative(rings)
  const total = cum[4]
  const step = niceStep(Math.max(total, 4) / 4)
  const top = Math.max(step, Math.ceil(total / step) * step)
  const bars: WaterfallBar[] = rings.map((n, i) => ({ label: `${BANDS[i]} m`, from: i ? cum[i - 1] : 0, to: cum[i], value: n, band: i }))
  bars.push({ label: 'Total', from: 0, to: total, value: total, band: null })
  const ticks: number[] = []
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100)
  return { bars, top, ticks }
}
