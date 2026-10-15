import { haversine } from './geo'

export function ringsIntersect(points: { lat: number; lon: number }[], radius: number): boolean {
  for (let i = 0; i < points.length; i++)
    for (let j = i + 1; j < points.length; j++)
      if (haversine(points[i].lat, points[i].lon, points[j].lat, points[j].lon) <= 2 * radius) return true
  return false
}
