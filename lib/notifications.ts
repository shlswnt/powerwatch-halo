export type Severity = 'error' | 'warning'

export interface NoteInput {
  /** Repeats with the same id merge into one entry. */
  id: string
  severity: Severity
  message: string
  /** Show a Retry button (building-file failures). */
  retry?: boolean
}

export interface Note extends NoteInput {
  at: number
  count: number
}

export interface NoteState {
  items: Note[]
  unread: number
}

export const EMPTY_NOTES: NoteState = { items: [], unread: 0 }

export function addNote(s: NoteState, n: NoteInput, now: number): NoteState {
  const prev = s.items.find((x) => x.id === n.id)
  const note: Note = { ...n, at: now, count: (prev?.count ?? 0) + 1 }
  return { items: [note, ...s.items.filter((x) => x.id !== n.id)], unread: s.unread + 1 }
}

export function markRead(s: NoteState): NoteState {
  return { ...s, unread: 0 }
}

export function clearNotes(): NoteState {
  return EMPTY_NOTES
}
