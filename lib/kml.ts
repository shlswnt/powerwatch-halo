import { XMLParser } from 'fast-xml-parser'
import type { Layer } from './types'

export const LAYERS: Record<string, Layer> = {
  'Freetown - Transformers': 'freetown',
  'Outside Freetown - Substations & Transformers': 'outside',
}

export interface RawPlacemark {
  name: string
  layer: Layer
  lat: number
  lon: number
  description: string
}

const parser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: false,
  trimValues: true,
  isArray: (tag) => tag === 'Folder' || tag === 'Placemark',
})

export function cleanDescription(html: string): string {
  return html
    .replace(/<img\b[^>]*>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function parseKml(xml: string): { placemarks: RawPlacemark[]; warnings: string[] } {
  const doc = parser.parse(xml)?.kml?.Document
  if (!doc) throw new Error('Not a KML document')
  type RawPm = { name?: unknown; description?: unknown; Point?: { coordinates?: unknown } }
  const folders: Array<{ name?: unknown; Placemark?: RawPm[] }> = doc.Folder ?? []
  const placemarks: RawPlacemark[] = []
  const warnings: string[] = []

  for (const [layerName, layer] of Object.entries(LAYERS)) {
    const folder = folders.find((f) => String(f.name ?? '').trim() === layerName)
    if (!folder) throw new Error(`Missing KML layer "${layerName}"`)
    for (const pm of folder.Placemark ?? []) {
      const name = String(pm.name ?? '').trim() || 'Unnamed transformer'
      const coords = pm.Point?.coordinates
      if (coords == null) {
        warnings.push(`Skipped "${name}" in "${layerName}": not a point`)
        continue
      }
      const [lon, lat] = String(coords).trim().split(',').map(Number)
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        warnings.push(`Skipped "${name}" in "${layerName}": bad coordinates "${coords}"`)
        continue
      }
      placemarks.push({ name, layer, lat, lon, description: cleanDescription(String(pm.description ?? '')) })
    }
  }
  return { placemarks, warnings }
}
