import { TOWNS } from './towns'
import { BANDS, type Radius, type TownId } from './types'

export interface ViewState {
  town: TownId | null
  selected: string[]
  radius: Radius
  overlap: boolean
}

export const DEFAULT_VIEW: ViewState = { town: null, selected: [], radius: 500, overlap: false }

export function parseView(p: URLSearchParams): ViewState {
  const town = p.get('town')
  const r = Number(p.get('r'))
  const overlap = p.get('o') === '1'
  const ids = [...new Set((p.get('t') ?? '').split(',').map((s) => s.trim()).filter(Boolean))].slice(0, 50)
  return {
    town: TOWNS.some((t) => t.id === town) ? (town as TownId) : null,
    selected: overlap ? ids : ids.slice(0, 1),
    radius: (BANDS as readonly number[]).includes(r) ? (r as Radius) : 500,
    overlap,
  }
}

export function serializeView(v: ViewState): string {
  const p = new URLSearchParams()
  if (v.town) p.set('town', v.town)
  if (v.selected.length) p.set('t', v.selected.join(','))
  if (v.radius !== 500) p.set('r', String(v.radius))
  if (v.overlap) p.set('o', '1')
  const s = p.toString().replace(/%2C/g, ',')
  return s ? `?${s}` : ''
}

export function dropUnknown(v: ViewState, known: Set<string>): { view: ViewState; dropped: number } {
  const selected = v.selected.filter((id) => known.has(id))
  return { view: { ...v, selected }, dropped: v.selected.length - selected.length }
}
