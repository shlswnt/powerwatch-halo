import type { ViewState } from './url-state'

const toggle = (ids: string[], id: string) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id])

export function openTransformer(v: ViewState, id: string): ViewState {
  return v.overlap ? { ...v, selected: toggle(v.selected, id) } : { ...v, selected: [id] }
}

/** Overlap checkbox: outside overlap mode it always adds (the viewed transformer stays in); inside it toggles. */
export function toggleMember(v: ViewState, id: string): ViewState {
  if (!v.overlap) return { ...v, overlap: true, selected: v.selected.includes(id) ? v.selected : [...v.selected, id] }
  return { ...v, selected: toggle(v.selected, id) }
}

export function setOverlap(v: ViewState, on: boolean): ViewState {
  if (on) return { ...v, overlap: true }
  return { ...v, overlap: false, selected: v.selected.slice(-1) }
}

export function clearSelection(v: ViewState): ViewState {
  return { ...v, selected: [], overlap: false }
}
