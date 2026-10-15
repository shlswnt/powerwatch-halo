import { describe, expect, it } from 'vitest'
import { cumulative, formatCount, ringsFromNear } from './counts'
import type { NearEntry } from './types'

describe('ringsFromNear', () => {
  it('bins by band and counts hi separately', () => {
    const near: NearEntry[] = [['a', 0, 1], ['b', 100, 0], ['c', 100.1, 1], ['d', 499.9, 1], ['e', 500, 0], ['f', 500.1, 1]]
    expect(ringsFromNear(near)).toEqual({ all: [2, 1, 0, 0, 2], hi: [1, 1, 0, 0, 1] })
  })
  it('counts duplicate keys as separate buildings', () =>
    expect(ringsFromNear([['dup', 10, 1], ['dup', 20, 0]])).toEqual({ all: [2, 0, 0, 0, 0], hi: [1, 0, 0, 0, 0] }))
  it('is all zeros for no buildings', () =>
    expect(ringsFromNear([])).toEqual({ all: [0, 0, 0, 0, 0], hi: [0, 0, 0, 0, 0] }))
})

describe('cumulative', () => {
  it('running sum', () => expect(cumulative([1, 2, 3, 4, 5])).toEqual([1, 3, 6, 10, 15]))
})

describe('formatCount', () => {
  it('range shows hi–all with thousands separators', () => expect(formatCount(3060, 1856, 'range')).toBe('1,856–3,060'))
  it('range collapses when equal', () => expect(formatCount(12, 12, 'range')).toBe('12'))
  it('all / hi modes', () => {
    expect(formatCount(3060, 1856, 'all')).toBe('3,060')
    expect(formatCount(3060, 1856, 'hi')).toBe('1,856')
  })
})
