import { createHash } from 'node:crypto'
import type { Layer } from './types'

export function baseId(layer: Layer, lat: number, lon: number): string {
  return createHash('sha1').update(`${layer}|${lat.toFixed(6)}|${lon.toFixed(6)}`).digest('hex').slice(0, 8)
}

export function assignIds<T extends { layer: Layer; lat: number; lon: number }>(items: T[]): (T & { id: string })[] {
  const seen = new Map<string, number>()
  return items.map((item) => {
    const base = baseId(item.layer, item.lat, item.lon)
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    return { ...item, id: n === 1 ? base : `${base}-${n}` }
  })
}
