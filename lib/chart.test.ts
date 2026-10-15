import { describe, expect, it } from 'vitest'
import { niceStep, tickLabel, waterfall } from './chart'

describe('chart', () => {
  it.each([[0, 1], [1, 1], [1.5, 2], [2.2, 2.5], [3, 5], [7, 10], [150, 200], [778.75, 1000]])('niceStep(%d) = %d', (x, s) =>
    expect(niceStep(x)).toBe(s))
  it('tick labels shorten thousands', () => {
    expect(tickLabel(500)).toBe('500')
    expect(tickLabel(1000)).toBe('1k')
    expect(tickLabel(2500)).toBe('2.5k')
  })
  it('waterfall: bands stack from the previous cumulative, Total from zero', () => {
    const w = waterfall([128, 355, 614, 896, 1122])
    expect(w.top).toBe(4000)
    expect(w.ticks).toEqual([0, 1000, 2000, 3000, 4000])
    expect(w.bars[1]).toEqual({ label: '200 m', from: 128, to: 483, value: 355, band: 1 })
    expect(w.bars[5]).toEqual({ label: 'Total', from: 0, to: 3115, value: 3115, band: null })
  })
  it('waterfall of zero buildings still has a scale', () => {
    const w = waterfall([0, 0, 0, 0, 0])
    expect(w.top).toBe(1)
    expect(w.ticks).toEqual([0, 1])
  })
})
