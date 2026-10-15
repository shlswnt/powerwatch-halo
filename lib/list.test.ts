import { describe, expect, it } from 'vitest'
import { cityOptions, cityStats, filterTransformers, median, nearbyIds, segments, sortTransformers, stepInList, toCsv, total500 } from './list'
import type { Rings, TownId, Transformer } from './types'

const t = (id: string, name: string, town: TownId, all: Rings, lat = 8, lon = -13): Transformer => ({
  id, name, layer: 'outside', town, lat, lon, description: '', kva: null, rings: { all, hi: [0, 0, 0, 0, 0] },
})
const ts = [
  t('aaaa0001', 'Air Field', 'kenema', [10, 0, 0, 0, 90]),
  t('aaaa0002', 'Bank SL', 'kenema', [50, 0, 0, 0, 0]),
  t('aaaa0003', 'Masonie', 'freetown', [1, 1, 1, 1, 1]),
  t('aaaa0004', 'Zulu, "Q"', 'bo', [0, 0, 0, 0, 200]),
]

describe('list helpers', () => {
  it('total500 sums the rings', () => expect(total500(ts[0])).toBe(100))
  it('filters by town and by name, town name or id', () => {
    expect(filterTransformers(ts, 'kenema', '').map((x) => x.id)).toEqual(['aaaa0001', 'aaaa0002'])
    expect(filterTransformers(ts, null, 'freetown').map((x) => x.id)).toEqual(['aaaa0003'])
    expect(filterTransformers(ts, null, '0002').map((x) => x.id)).toEqual(['aaaa0002'])
    expect(filterTransformers(ts, null, 'bank').map((x) => x.id)).toEqual(['aaaa0002'])
  })
  it('sorts by reach, by ≤100 m, and by name', () => {
    expect(sortTransformers(ts, 'reach').map((x) => x.name)).toEqual(['Zulu, "Q"', 'Air Field', 'Bank SL', 'Masonie'])
    expect(sortTransformers(ts, 'near').map((x) => x.name)).toEqual(['Bank SL', 'Air Field', 'Masonie', 'Zulu, "Q"'])
    expect(sortTransformers(ts, 'name').map((x) => x.name)).toEqual(['Air Field', 'Bank SL', 'Masonie', 'Zulu, "Q"'])
  })
  it('median of odd, even and empty lists', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([1, 2, 3, 10])).toBe(3)
    expect(median([])).toBe(0)
  })
  it('city options: all first, then towns by count, empty towns last as 0', () => {
    const o = cityOptions(ts)
    expect(o[0]).toEqual({ value: 'all', label: 'All cities · 4' })
    expect(o[1]).toEqual({ value: 'kenema', label: 'Kenema · 2' })
    expect(o.find((x) => x.value === 'koidu')).toEqual({ value: 'koidu', label: 'Koidu · 0' })
    expect(o).toHaveLength(13)
  })
  it('city stats skip empty towns', () =>
    expect(cityStats(ts)).toEqual([
      { town: 'kenema', name: 'Kenema', n: 2, median: 75 },
      { town: 'bo', name: 'Bo', n: 1, median: 200 },
      { town: 'freetown', name: 'Freetown', n: 1, median: 5 },
    ]))
  it('segments are band widths as % of the list maximum', () => {
    expect(segments(ts[0], 200)).toEqual([5, 0, 0, 0, 45])
    expect(segments(ts[0], 0)).toEqual([0, 0, 0, 0, 0])
  })
  it('steps through the list order and wraps; an id not in the list jumps to the first', () => {
    const ids = ['a', 'b', 'c']
    expect(stepInList(ids, 'a', 1)).toBe('b')
    expect(stepInList(ids, 'a', -1)).toBe('c')
    expect(stepInList(ids, 'zzz', 1)).toBe('a')
    expect(stepInList([], 'zzz', 1)).toBe('zzz')
  })
  it('nearby: up to k others within maxM, nearest first', () => {
    const base = t('n0', 'Base', 'bo', [0, 0, 0, 0, 0], 8, -13)
    const near1 = t('n1', 'Near', 'bo', [0, 0, 0, 0, 0], 8.002, -13)
    const near2 = t('n2', 'Nearer', 'bo', [0, 0, 0, 0, 0], 8.001, -13)
    const far = t('n3', 'Far', 'bo', [0, 0, 0, 0, 0], 8.02, -13)
    expect(nearbyIds([base, near1, near2, far], base)).toEqual(['n2', 'n1'])
  })
  it('CSV: header, counts and cumulative, quoted names', () => {
    const lines = toCsv([ts[3]]).split('\n')
    expect(lines[0]).toBe('id,name,town,lat,lon,kva,b0_100m,b100_200m,b200_300m,b300_400m,b400_500m,within_100m,within_200m,within_300m,within_400m,within_500m')
    expect(lines[1]).toBe('aaaa0004,"Zulu, ""Q""",Bo,8,-13,,0,0,0,0,200,0,0,0,0,200')
    expect(toCsv([]).split('\n')).toHaveLength(1)
  })
})
