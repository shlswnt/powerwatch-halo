import type { ExpressionSpecification, StyleSpecification } from 'maplibre-gl'
import type { FeatureCollection, Polygon } from 'geojson'
import { KEY_EXPRESSION } from './building-key'
import { bandIndex, circlePolygon } from './geo'
import { BANDS, type NearEntry } from './types'

export const BUILDINGS_URL = 'pmtiles://https://data.source.coop/vida/google-microsoft-open-buildings/pmtiles/goog_msft.pmtiles'
export const BUILDINGS_LAYER = 'goog_msft_building_footprints'
export const BUILDINGS_ATTRIBUTION = 'Buildings © Google, Microsoft (merged by VIDA)'

export function imageryStyle(token: string, labels: boolean): StyleSpecification {
  const style = labels ? 'satellite-streets-v12' : 'satellite-v9'
  return {
    version: 8,
    sources: {
      imagery: {
        type: 'raster',
        tiles: [`https://api.mapbox.com/styles/v1/mapbox/${style}/tiles/512/{z}/{x}/{y}@2x?access_token=${token}`],
        tileSize: 512,
        maxzoom: 20,
        attribution: 'Maps © Mapbox © OpenStreetMap © Maxar',
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#0d0d0d' } },
      { id: 'imagery', type: 'raster', source: 'imagery', paint: { 'raster-opacity': 0.78 } },
    ],
  }
}

/** 100 m → 500 m, warm → cool; each step also drops in lightness (spec §3). */
export const BAND_COLORS = ['#facc15', '#fb923c', '#f472b6', '#a78bfa', '#38bdf8'] as const
export const OVERLAP_COLOR = '#ffffff'

type Paint = ExpressionSpecification | string | number

/** Entries arrive sorted by distance, so the first occurrence of a key is its nearest band. */



export function bandRings(lat: number, lon: number): FeatureCollection<Polygon, { band: number }> {
  return {
    type: 'FeatureCollection',
    features: BANDS.map((outer, band) => {
      const coordinates = [circlePolygon(lat, lon, outer)]
      if (band > 0) coordinates.push(circlePolygon(lat, lon, BANDS[band - 1]).reverse())
      return { type: 'Feature', properties: { band }, geometry: { type: 'Polygon', coordinates } }
    }),
  }
}


const FAINT_LINE = 'rgba(255,255,255,0.32)'
const NONE = 'rgba(0,0,0,0)'

/** One transformer: each key's band. Entries arrive sorted by distance, so the first occurrence is the nearest. */
export function singleBands(near: NearEntry[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const [key, d] of near) {
    if (m.has(key)) continue
    const b = bandIndex(d)
    if (b !== null) m.set(key, b)
  }
  return m
}

/** Footprint fill/outline for the current selection. Keys appear in at most one match branch (MapLibre rejects duplicates). */
export function footprintPaint(bands: ReadonlyMap<string, number> | null, shared: string[], compare: boolean) {
  const sharedSet = new Set(shared)
  const groups: string[][] = [[], [], [], [], []]
  for (const [key, b] of bands ?? []) if (!sharedSet.has(key)) groups[b].push(key)
  const fill: unknown[] = ['match', KEY_EXPRESSION]
  const line: unknown[] = ['match', KEY_EXPRESSION]
  if (shared.length) {
    fill.push(shared, OVERLAP_COLOR)
    line.push(shared, OVERLAP_COLOR)
  }
  groups.forEach((keys, b) => {
    if (!keys.length) return
    fill.push(keys, BAND_COLORS[b])
    line.push(keys, compare ? `${BAND_COLORS[b]}99` : BAND_COLORS[b])
  })
  const any = fill.length > 2
  return {
    fillColor: (any ? [...fill, NONE] : NONE) as Paint,
    fillOpacity: (compare ? (shared.length ? ['match', KEY_EXPRESSION, shared, 0.88, 0.32] : 0.32) : 0.55) as Paint,
    lineColor: (any ? [...line, FAINT_LINE] : FAINT_LINE) as Paint,
  }
}

/** The point `m` metres due north (for ring labels). */
export function northOf(lat: number, lon: number, m: number): [number, number] {
  return [lon, lat + ((m / 6_371_000) * 180) / Math.PI]
}

/** Radius in screen pixels of a ring of `r` metres at this latitude and zoom (512 px tiles). */
export function ringPixels(r: number, lat: number, zoom: number): number {
  return r / ((40_075_016.686 * Math.cos((lat * Math.PI) / 180)) / (512 * 2 ** zoom))
}
