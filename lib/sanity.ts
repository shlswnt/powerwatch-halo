import type { TownId, Transformer } from './types'

export const MIN_TRANSFORMERS = 525

export const TOWNS_WITH_DATA: TownId[] = [
  'freetown', 'bo', 'kenema', 'lunsar', 'lungi', 'port-loko', 'makeni', 'bumbuna', 'moyamba', 'magburaka', 'koidu',
]

/** 500 m cumulative counts measured 2026-10-14 (VIDA SLE parquet, bbox centre, haversine). */
export const REFERENCES: { town: TownId; name: string; lat: number; lon: number; all: number; hi: number }[] = [
  { town: 'freetown', name: 'Masonie', lat: 8.4588254, lon: -13.1879126, all: 3115, hi: 1856 },
  { town: 'freetown', name: 'Transformer', lat: 8.4562183, lon: -13.2251924, all: 1718, hi: 1058 },
  { town: 'freetown', name: 'Transformer', lat: 8.3283659, lon: -13.0709326, all: 2671, hi: 1707 },
  { town: 'bumbuna', name: 'Bumbuna', lat: 9.0449352, lon: -11.7482168, all: 1199, hi: 943 },
  { town: 'bo', name: 'Transformer', lat: 7.9644145, lon: -11.7398704, all: 2331, hi: 1570 },
  { town: 'kenema', name: 'Momoh Ghottor', lat: 7.8747342, lon: -11.1877479, all: 2191, hi: 1581 },
  { town: 'makeni', name: 'Transformer', lat: 8.9051832, lon: -12.0292293, all: 1201, hi: 914 },
  { town: 'moyamba', name: 'N', lat: 8.1520638, lon: -12.4345295, all: 818, hi: 606 },
  { town: 'port-loko', name: 'Water Works', lat: 8.7618468, lon: -12.7750009, all: 298, hi: 216 },
  { town: 'lungi', name: 'Perimeter', lat: 8.6146401, lon: -13.2045863, all: 636, hi: 351 },
  { town: 'lunsar', name: 'Delco Road', lat: 8.6844645, lon: -12.5307595, all: 1478, hi: 1077 },
  { town: 'magburaka', name: 'Reservation', lat: 8.7249281, lon: -11.9272729, all: 437, hi: 366 },
]

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

export function sanityCheck(ts: Transformer[]): string[] {
  const problems: string[] = []
  if (ts.length < MIN_TRANSFORMERS) problems.push(`Expected at least ${MIN_TRANSFORMERS} transformers, got ${ts.length}`)
  for (const town of TOWNS_WITH_DATA)
    if (!ts.some((t) => t.town === town)) problems.push(`Town "${town}" has no transformers`)
  for (const ref of REFERENCES) {
    const label = `Reference "${ref.name}" (${ref.lat}, ${ref.lon})`
    const t = ts.find((t) => Math.abs(t.lat - ref.lat) < 1e-7 && Math.abs(t.lon - ref.lon) < 1e-7)
    if (!t) {
      problems.push(`${label} not found — was the pin moved or deleted?`)
      continue
    }
    const checks: [string, number, number][] = [['all', sum(t.rings.all), ref.all], ['hi', sum(t.rings.hi), ref.hi]]
    for (const [kind, got, want] of checks)
      if (Math.abs(got - want) > want * 0.01) problems.push(`${label} ${kind} = ${got}, expected ${want} ±1%`)
  }
  return problems
}
