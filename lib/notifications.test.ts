import { describe, expect, it } from 'vitest'
import { EMPTY_NOTES, addNote, clearNotes, markRead } from './notifications'

const err = { id: 'near-a', severity: 'error' as const, message: "Couldn't load building highlights for A" }
const warn = { id: 'link-unknown', severity: 'warning' as const, message: '1 transformer in this link wasn’t found.' }

describe('notifications', () => {
  it('adds newest first and counts unread', () => {
    const s = addNote(addNote(EMPTY_NOTES, err, 1), warn, 2)
    expect(s.items.map((n) => n.id)).toEqual(['link-unknown', 'near-a'])
    expect(s.unread).toBe(2)
  })
  it('merges a repeat of the same id: one entry, bumped count and time, moved to the top, unread again', () => {
    const s = markRead(addNote(addNote(EMPTY_NOTES, err, 1), warn, 2))
    const r = addNote(s, err, 3)
    expect(r.items).toHaveLength(2)
    expect(r.items[0]).toMatchObject({ id: 'near-a', count: 2, at: 3 })
    expect(r.unread).toBe(1)
  })
  it('a repeat keeps the latest message', () =>
    expect(addNote(addNote(EMPTY_NOTES, err, 1), { ...err, message: 'new text' }, 2).items[0].message).toBe('new text'))
  it('markRead zeroes unread and keeps items', () => {
    const s = markRead(addNote(EMPTY_NOTES, err, 1))
    expect(s.unread).toBe(0)
    expect(s.items).toHaveLength(1)
  })
  it('clearNotes empties everything', () => expect(clearNotes()).toEqual(EMPTY_NOTES))
})
