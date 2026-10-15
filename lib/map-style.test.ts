import { describe, expect, it } from 'vitest'
import { haversine } from './geo'
import { KEY_EXPRESSION } from './building-key'
import {
  BAND_COLORS, OVERLAP_COLOR,
  bandRings, footprintPaint, imageryStyle, northOf, ringPixels, singleBands,
} from './map-style'

describe('imageryStyle', () => {
  it('uses satellite-streets with labels and plain satellite without', () => {
    const tiles = (labels: boolean) => (imageryStyle('pk.test', labels).sources.imagery as { tiles: string[] }).tiles[0]
    expect(tiles(true)).toBe('https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/512/{z}/{x}/{y}@2x?access_token=pk.test')
    expect(tiles(false)).toContain('/mapbox/satellite-v9/tiles/512/')
  })
})



describe('ring geometry', () => {
  it('bandRings: five annuli, band 0 is a disc', () => {
    const fc = bandRings(8.46, -13.19)
    expect(fc.features.map((f) => f.properties.band)).toEqual([0, 1, 2, 3, 4])
    expect(fc.features[0].geometry.coordinates).toHaveLength(1)
    expect(fc.features[4].geometry.coordinates).toHaveLength(2)
  })
})

describe('palette', () => {
  it('is the mockup band scale, warm to cool, with white for shared', () => {
    expect(BAND_COLORS).toEqual(['#facc15', '#fb923c', '#f472b6', '#a78bfa', '#38bdf8'])
    expect(OVERLAP_COLOR).toBe('#ffffff')
  })
})

describe('imageryStyle dimming', () => {
  it('dims imagery to 78% over near-black', () => {
    const s = imageryStyle('pk.test', true)
    expect(s.layers[0]).toEqual({ id: 'background', type: 'background', paint: { 'background-color': '#0d0d0d' } })
    expect(s.layers[1]).toMatchObject({ id: 'imagery', paint: { 'raster-opacity': 0.78 } })
  })
})

describe('singleBands', () => {
  it('nearest band per key; duplicates keep the first (nearest) entry', () =>
    expect(Object.fromEntries(singleBands([['a', 50, 1], ['b', 250, 0], ['a', 450, 1], ['c', 520, 1]]))).toEqual({ a: 0, b: 2 }))
})

describe('footprintPaint', () => {
  const FAINT = 'rgba(255,255,255,0.32)'
  const NONE = 'rgba(0,0,0,0)'
  it('nothing selected: no fill, faint outlines', () =>
    expect(footprintPaint(null, [], false)).toEqual({ fillColor: NONE, fillOpacity: 0.55, lineColor: FAINT }))
  it('single: band fill at 55% and band outlines', () =>
    expect(footprintPaint(new Map([['a', 0], ['b', 4]]), [], false)).toEqual({
      fillColor: ['match', KEY_EXPRESSION, ['a'], BAND_COLORS[0], ['b'], BAND_COLORS[4], NONE],
      fillOpacity: 0.55,
      lineColor: ['match', KEY_EXPRESSION, ['a'], BAND_COLORS[0], ['b'], BAND_COLORS[4], FAINT],
    }))
  it('compare: shared keys white and out of the band groups; outlines at 60%', () =>
    expect(footprintPaint(new Map([['a', 0], ['s', 1]]), ['s'], true)).toEqual({
      fillColor: ['match', KEY_EXPRESSION, ['s'], OVERLAP_COLOR, ['a'], BAND_COLORS[0], NONE],
      fillOpacity: ['match', KEY_EXPRESSION, ['s'], 0.88, 0.32],
      lineColor: ['match', KEY_EXPRESSION, ['s'], OVERLAP_COLOR, ['a'], `${BAND_COLORS[0]}99`, FAINT],
    }))
})

describe('ring label geometry', () => {
  it('northOf moves north by metres', () => {
    const [lon, lat] = northOf(8, -13, 500)
    expect(lon).toBe(-13)
    expect(haversine(8, -13, lat, lon)).toBeCloseTo(500, 0)
  })
  it('ringPixels: 500 m at the equator, zoom 15 ≈ 209 px', () => expect(ringPixels(500, 0, 15)).toBeCloseTo(209.4, 0))
})
