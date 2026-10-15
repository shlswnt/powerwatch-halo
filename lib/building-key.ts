import type { ExpressionSpecification } from 'maplibre-gl'

/** Same string MapLibre builds from a VIDA tile feature with KEY_EXPRESSION. */
export function buildingKey(geohash: string, area: number): string {
  return `${geohash}|${String(area)}`
}

export const KEY_EXPRESSION: ExpressionSpecification = ['concat', ['get', 'geohash'], '|', ['to-string', ['get', 'area_in_meters']]]
