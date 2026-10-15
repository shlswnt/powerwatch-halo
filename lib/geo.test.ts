import { describe, expect, it } from 'vitest'
import { bandIndex, circlePolygon, haversine, nearestTown } from './geo'

describe('haversine', () => {
  it('is 0 for the same point', () => expect(haversine(8.4, -13.2, 8.4, -13.2)).toBe(0))
  it('1° of latitude is 111,194.93 m', () => expect(haversine(8, -13, 9, -13)).toBeCloseTo(111194.93, 1))
  it('Freetown centre → Kenema centre is 235,203.3 m', () =>
    expect(haversine(8.4844, -13.2344, 7.8767, -11.1875)).toBeCloseTo(235203.3, 0))
})

describe('bandIndex', () => {
  it.each([
    [0, 0], [50, 0], [100, 0], [100.01, 1], [250, 2], [300, 2], [499.9, 4], [500, 4],
  ])('%d m → band %d', (d, band) => expect(bandIndex(d)).toBe(band))
  it.each([500.01, 600, -1, Number.NaN])('%d m → excluded', (d) => expect(bandIndex(d)).toBeNull())
})

describe('nearestTown', () => {
  it('Momoh Ghottor → Kenema', () => expect(nearestTown(7.8747342, -11.1877479).town.id).toBe('kenema'))
  it('Bandajuma substation → Bo', () => expect(nearestTown(7.9422887, -11.6687089).town.id).toBe('bo'))
  it('Tagrin → Lungi (14.0 km), never Freetown even though Freetown is closer (10.2 km)', () => {
    const r = nearestTown(8.5194868, -13.1483203)
    expect(r.town.id).toBe('lungi')
    expect(r.km).toBeCloseTo(13.99, 1)
  })
})

describe('circlePolygon', () => {
  it('is a closed ring of steps+1 points, every vertex at the radius', () => {
    const ring = circlePolygon(8.46, -13.19, 300, 32)
    expect(ring).toHaveLength(33)
    expect(ring[32]).toEqual(ring[0])
    for (const [lon, lat] of ring) expect(haversine(8.46, -13.19, lat, lon)).toBeCloseTo(300, 0)
  })
})
