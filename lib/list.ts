import { haversine } from './geo'
import { TOWNS, townById } from './towns'
import { BANDS, type TownId, type Transformer } from './types'

export type SortKey = 'reach' | 'near' | 'name'

export const total500 = (t: Transformer) => t.rings.all.reduce((a, b) => a + b, 0)

export function filterTransformers(ts: Transformer[], town: TownId | null, query: string): Transformer[] {
  const q = query.trim().toLowerCase()
  return ts.filter((t) => (!town || t.town === town) && (!q || `${t.name} ${townById(t.town).name} ${t.id}`.toLowerCase().includes(q)))
}

export function sortTransformers(ts: Transformer[], sort: SortKey): Transformer[] {
  const byName = (a: Transformer, b: Transformer) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
  const out = [...ts]
  if (sort === 'name') return out.sort(byName)
  if (sort === 'near') return out.sort((a, b) => b.rings.all[0] - a.rings.all[0] || total500(b) - total500(a) || byName(a, b))
  return out.sort((a, b) => total500(b) - total500(a) || byName(a, b))
}

export function median(xs: number[]): number {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2)
}

const countBy = (ts: Transformer[]) => {
  const m = new Map<TownId, Transformer[]>()
  for (const t of ts) m.set(t.town, [...(m.get(t.town) ?? []), t])
  return m
}

export function cityOptions(ts: Transformer[]): { value: TownId | 'all'; label: string }[] {
  const by = countBy(ts)
  const towns = [...TOWNS].sort((a, b) => (by.get(b.id)?.length ?? 0) - (by.get(a.id)?.length ?? 0) || a.name.localeCompare(b.name))
  return [{ value: 'all' as const, label: `All cities · ${ts.length}` }, ...towns.map((t) => ({ value: t.id, label: `${t.name} · ${by.get(t.id)?.length ?? 0}` }))]
}

export function cityStats(ts: Transformer[]): { town: TownId; name: string; n: number; median: number }[] {
  return [...countBy(ts)]
    .map(([town, list]) => ({ town, name: townById(town).name, n: list.length, median: median(list.map(total500)) }))
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name))
}

export function segments(t: Transformer, max: number): number[] {
  return t.rings.all.map((n) => (max > 0 ? Math.round((n / max) * 10000) / 100 : 0))
}

export function stepInList(ids: string[], id: string, dir: 1 | -1): string {
  if (!ids.length) return id
  const i = ids.indexOf(id)
  if (i < 0) return ids[0]
  return ids[(i + dir + ids.length) % ids.length]
}

export function nearbyIds(ts: Transformer[], t: Transformer, maxM = 1000, k = 2): string[] {
  return ts
    .filter((o) => o.id !== t.id)
    .map((o) => [o.id, haversine(t.lat, t.lon, o.lat, o.lon)] as const)
    .filter(([, d]) => d <= maxM)
    .sort((a, b) => a[1] - b[1])
    .slice(0, k)
    .map(([id]) => id)
}

const csvField = (v: unknown) => {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(ts: Transformer[]): string {
  const head = ['id', 'name', 'town', 'lat', 'lon', 'kva', ...BANDS.map((r, i) => `b${i * 100}_${r}m`), ...BANDS.map((r) => `within_${r}m`)]
  const rows = ts.map((t) => {
    let sum = 0
    const cum = t.rings.all.map((n) => (sum += n))
    return [t.id, t.name, townById(t.town).name, t.lat, t.lon, t.kva, ...t.rings.all, ...cum].map(csvField).join(',')
  })
  return [head.join(','), ...rows].join('\n')
}
