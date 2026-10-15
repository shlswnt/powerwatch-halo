import type { TownId } from './types'

export interface Town {
  id: TownId
  name: string
  lat: number
  lon: number
}

export const TOWNS: Town[] = [
  { id: 'freetown', name: 'Freetown', lat: 8.4844, lon: -13.2344 },
  { id: 'bo', name: 'Bo', lat: 7.9647, lon: -11.7383 },
  { id: 'kenema', name: 'Kenema', lat: 7.8767, lon: -11.1875 },
  { id: 'lunsar', name: 'Lunsar', lat: 8.6844, lon: -12.535 },
  { id: 'lungi', name: 'Lungi', lat: 8.6297, lon: -13.2097 },
  { id: 'port-loko', name: 'Port Loko', lat: 8.7667, lon: -12.7833 },
  { id: 'makeni', name: 'Makeni', lat: 8.8833, lon: -12.05 },
  { id: 'moriba', name: 'Moriba', lat: 7.7882, lon: -12.2991 },
  { id: 'bumbuna', name: 'Bumbuna', lat: 9.045, lon: -11.748 },
  { id: 'moyamba', name: 'Moyamba', lat: 8.1606, lon: -12.4333 },
  { id: 'magburaka', name: 'Magburaka', lat: 8.7167, lon: -11.95 },
  { id: 'koidu', name: 'Koidu', lat: 8.6439, lon: -10.9714 },
]

export function townById(id: TownId): Town {
  const t = TOWNS.find((t) => t.id === id)
  if (!t) throw new Error(`Unknown town ${id}`)
  return t
}
