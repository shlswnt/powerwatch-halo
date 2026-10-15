import { describe, expect, it } from 'vitest'
import { DEFAULT_VIEW, dropUnknown, parseView, serializeView } from './url-state'

const parse = (s: string) => parseView(new URLSearchParams(s))

describe('parseView', () => {
  it('empty → defaults', () => expect(parse('')).toEqual(DEFAULT_VIEW))
  it('reads a full link', () =>
    expect(parse('town=kenema&t=aaaa1111,bbbb2222&r=300&o=1')).toEqual({ town: 'kenema', selected: ['aaaa1111', 'bbbb2222'], radius: 300, overlap: true }))
  it('sanitises a stale/malformed link', () =>
    expect(parse('town=nowhere&t=deadbeef,,deadbeef,x&r=250')).toEqual({ town: null, selected: ['deadbeef'], radius: 500, overlap: false }))
  it('keeps every id in overlap mode, only the first otherwise', () => {
    expect(parse('t=a,b,c&o=1').selected).toEqual(['a', 'b', 'c'])
    expect(parse('t=a,b,c').selected).toEqual(['a'])
  })
})

describe('serializeView', () => {
  it('omits defaults', () => expect(serializeView(DEFAULT_VIEW)).toBe(''))
  it('round-trips with readable commas', () => {
    const v = { town: 'bo' as const, selected: ['aaaa1111', 'bbbb2222'], radius: 200 as const, overlap: true }
    const s = serializeView(v)
    expect(s).toBe('?town=bo&t=aaaa1111,bbbb2222&r=200&o=1')
    expect(parse(s.slice(1))).toEqual(v)
  })
})

describe('dropUnknown', () => {
  it('drops ids that are not in the data and reports how many', () => {
    const v = { ...DEFAULT_VIEW, selected: ['a', 'zzz', 'b'], overlap: true }
    expect(dropUnknown(v, new Set(['a', 'b']))).toEqual({ view: { ...v, selected: ['a', 'b'] }, dropped: 1 })
  })
})
