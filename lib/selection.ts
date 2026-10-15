import type { ViewState } from './url-state'

const toggle = (ids: string[], id: string) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id])

// Compare (overlap) mode follows the ticks: it is on exactly while something is ticked, so unticking the last one
// leaves it. There is no separate switch.
const ticked = (v: ViewState, selected: string[]): ViewState => ({ ...v, selected, overlap: selected.length > 0 })

export function openTransformer(v: ViewState, id: string): ViewState {
  return v.overlap ? ticked(v, toggle(v.selected, id)) : { ...v, selected: [id] }
}

/** Checkbox: outside compare mode it always adds (the viewed transformer stays in); inside it toggles. */
export function toggleMember(v: ViewState, id: string): ViewState {
  if (!v.overlap) return ticked(v, v.selected.includes(id) ? v.selected : [...v.selected, id])
  return ticked(v, toggle(v.selected, id))
}

export function clearSelection(v: ViewState): ViewState {
  return { ...v, selected: [], overlap: false }
}
