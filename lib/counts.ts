import { bandIndex } from './geo'
import type { NearEntry, Rings } from './types'

export type CountMode = 'range' | 'all' | 'hi'

export function ringsFromNear(near: NearEntry[]): { all: Rings; hi: Rings } {
  const all: Rings = [0, 0, 0, 0, 0]
  const hi: Rings = [0, 0, 0, 0, 0]
  for (const [, d, h] of near) {
    const b = bandIndex(d)
    if (b === null) continue
    all[b]++
    if (h) hi[b]++
  }
  return { all, hi }
}

export function cumulative(r: Rings): Rings {
  let sum = 0
  return r.map((v) => (sum += v)) as Rings
}

const fmt = (n: number) => n.toLocaleString('en-US')

export function formatCount(all: number, hi: number, mode: CountMode): string {
  if (mode === 'all') return fmt(all)
  if (mode === 'hi') return fmt(hi)
  return hi === all ? fmt(all) : `${fmt(hi)}–${fmt(all)}`
}
