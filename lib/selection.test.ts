import { describe, expect, it } from 'vitest'
import { clearSelection, openTransformer, setOverlap, toggleMember } from './selection'
import { DEFAULT_VIEW } from './url-state'

const v = DEFAULT_VIEW

describe('selection transitions', () => {
  it('open replaces the selection outside overlap mode', () =>
    expect(openTransformer({ ...v, selected: ['a'] }, 'b').selected).toEqual(['b']))
  it('open toggles membership in overlap mode', () => {
    const o = { ...v, overlap: true, selected: ['a'] }
    expect(openTransformer(o, 'b').selected).toEqual(['a', 'b'])
    expect(openTransformer({ ...o, selected: ['a', 'b'] }, 'a').selected).toEqual(['b'])
  })
  it('toggleMember turns overlap on', () => expect(toggleMember({ ...v, selected: ['a'] }, 'b')).toMatchObject({ overlap: true, selected: ['a', 'b'] }))
  it('toggleMember on the transformer being viewed adds it to the overlap, never removes it', () =>
    expect(toggleMember({ ...v, selected: ['a'] }, 'a')).toMatchObject({ overlap: true, selected: ['a'] }))
  it('overlap off keeps only the last selected', () =>
    expect(setOverlap({ ...v, overlap: true, selected: ['a', 'b'] }, false)).toMatchObject({ overlap: false, selected: ['b'] }))
  it('clearSelection resets selection and overlap but keeps town and radius', () =>
    expect(clearSelection({ town: 'bo', selected: ['a'], radius: 300, overlap: true })).toEqual({ town: 'bo', selected: [], radius: 300, overlap: false }))
})
