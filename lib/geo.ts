import { TOWNS, type Town } from './towns'

const R = 6_371_000
const toRad = (d: number) => (d * Math.PI) / 180
const toDeg = (r: number) => (r * 180) / Math.PI

export function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

/** 0-based band for distance d (m): band k holds (k·100, (k+1)·100]; 0 m is band 0; > 500 m is null. */
export function bandIndex(d: number): number | null {
  if (!(d >= 0) || d > 500) return null
  return d === 0 ? 0 : Math.ceil(d / 100) - 1
}

/** Nearest town centre for an outside-Freetown transformer. Freetown is never a candidate. */
export function nearestTown(lat: number, lon: number): { town: Town; km: number } {
  let best: { town: Town; d: number } | null = null
  for (const town of TOWNS) {
    if (town.id === 'freetown') continue
    const d = haversine(lat, lon, town.lat, town.lon)
    if (!best || d < best.d) best = { town, d }
  }
  return { town: best!.town, km: best!.d / 1000 }
}

export function circlePolygon(lat: number, lon: number, radiusM: number, steps = 64): [number, number][] {
  const δ = radiusM / R
  const φ1 = toRad(lat)
  const λ1 = toRad(lon)
  const pts: [number, number][] = []
  for (let i = 0; i <= steps; i++) {
    const θ = (2 * Math.PI * i) / steps
    const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ))
    const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2))
    pts.push([toDeg(λ2), toDeg(φ2)])
  }
  pts[steps] = pts[0]
  return pts
}
