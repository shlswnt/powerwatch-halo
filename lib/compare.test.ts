import { describe, expect, it } from 'vitest'
import { compareStats, compareTint } from './compare'
import type { NearEntry } from './types'

const A: NearEntry[] = [['k1', 50, 1], ['k2', 150, 0], ['k3', 450, 1], ['k9', 480, 1]]
const B: NearEntry[] = [['k1', 90, 1], ['k2', 420, 0], ['k3', 120, 1], ['k4', 10, 1]]

describe('compareStats', () => {
  it('covered, shared, in range and only-this for every radius', () =>
    expect(compareStats([A, B])).toEqual({
      covered: [2, 4, 4, 4, 5],
      shared: [1, 1, 1, 1, 3],
      inRange: [[1, 2], [2, 3], [2, 3], [2, 3], [4, 4]],
      only: [[0, 1], [1, 2], [1, 2], [1, 2], [1, 1]],
    }))
  it('a key repeated inside one list counts once for that transformer and is never shared by itself', () => {
    const s = compareStats([[['dup', 10, 1], ['dup', 20, 1]], [['other', 5, 1]]])
    expect(s.shared).toEqual([0, 0, 0, 0, 0])
    expect(s.covered[0]).toBe(2)
    expect(s.inRange[0]).toEqual([1, 1])
  })
  it('no lists → zeros', () => expect(compareStats([]).covered).toEqual([0, 0, 0, 0, 0]))
})

describe('compareTint', () => {
  it('bands come from the nearest selected transformer; shared keys at the radius', () => {
    const t = compareTint([A, B], 500)
    expect(Object.fromEntries(t.bands)).toEqual({ k1: 0, k2: 1, k3: 1, k9: 4, k4: 0 })
    expect(t.shared).toEqual(['k1', 'k2', 'k3'])
    expect(compareTint([A, B], 100).shared).toEqual(['k1'])
  })
})
