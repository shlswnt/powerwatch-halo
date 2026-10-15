import { describe, expect, it } from 'vitest'
import { MIN_TRANSFORMERS, REFERENCES, sanityCheck } from './sanity'
import { TOWNS } from './towns'
import type { TownId, Transformer } from './types'

const make = (i: number, town: TownId, lat = 0, lon = i, all = 0, hi = 0): Transformer => ({
  id: `t${i}`, name: `T${i}`, layer: town === 'freetown' ? 'freetown' : 'outside', town, lat, lon, description: '', kva: null,
  rings: { all: [all, 0, 0, 0, 0], hi: [hi, 0, 0, 0, 0] },
})

function goodSet(extra: Transformer[] = []): Transformer[] {
  const refs = REFERENCES.map((r, i) => make(1000 + i, r.town, r.lat, r.lon, r.all, r.hi))
  const towns = TOWNS.filter((t) => t.id !== 'moriba' && t.id !== 'koidu')
  const filler = Array.from({ length: MIN_TRANSFORMERS - refs.length }, (_, i) => make(i, towns[i % towns.length].id))
  return [...refs, ...filler, ...extra]
}

describe('sanityCheck', () => {
  it('passes on a good set', () => expect(sanityCheck(goodSet())).toEqual([]))
  it('passes when new pins are added, including a new town', () =>
    expect(sanityCheck(goodSet(Array.from({ length: 12 }, (_, i) => make(5000 + i, 'koidu'))))).toEqual([]))
  it('fails below 525 transformers', () =>
    expect(sanityCheck(goodSet().slice(0, 500)).join('\n')).toContain('at least 525'))
  it('fails when a surveyed town disappears', () =>
    expect(sanityCheck(goodSet().map((t) => (t.town === 'lunsar' ? { ...t, town: 'bo' } : t))).join('\n')).toContain('"lunsar"'))
  it('fails when a reference count drifts more than 1%', () => {
    const ts = goodSet()
    ts[0] = { ...ts[0], rings: { ...ts[0].rings, all: [Math.round(REFERENCES[0].all * 1.02), 0, 0, 0, 0] } }
    expect(sanityCheck(ts).join('\n')).toContain(`${REFERENCES[0].name}`)
  })
  it('names a reference transformer that has moved', () => {
    const ts = goodSet()
    ts[3] = { ...ts[3], lat: ts[3].lat + 0.001 }
    expect(sanityCheck(ts).join('\n')).toContain('not found')
  })
})
