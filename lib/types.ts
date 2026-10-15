export const BANDS = [100, 200, 300, 400, 500] as const
export type Radius = (typeof BANDS)[number]

export type TownId =
  | 'freetown' | 'bo' | 'kenema' | 'lunsar' | 'lungi' | 'port-loko'
  | 'makeni' | 'moriba' | 'bumbuna' | 'moyamba' | 'magburaka' | 'koidu'

export type Layer = 'freetown' | 'outside'

/** Per-ring counts; index 0 = 0–100 m … index 4 = 400–500 m. */
export type Rings = [number, number, number, number, number]

export interface Transformer {
  id: string
  name: string
  layer: Layer
  town: TownId
  lat: number
  lon: number
  description: string
  /** Capacity read from the description; null when not stated. */
  kva: number | null
  rings: { all: Rings; hi: Rings }
}

/** key = `${geohash}|${area_in_meters}` — matches VIDA's tile features. */
export type NearEntry = [key: string, distanceM: number, hi: 0 | 1]

export interface Meta {
  builtAt: string
  source: string
  transformerCount: number
  buildingCount: number
  /** Problems the data step noticed in the KML (skipped placemarks, transformers far from any town). */
  warnings: string[]
}
