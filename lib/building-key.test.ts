import { createExpression } from '@maplibre/maplibre-gl-style-spec'
import { describe, expect, it } from 'vitest'
import { KEY_EXPRESSION, buildingKey } from './building-key'

const expr = createExpression(KEY_EXPRESSION, 'test')
if (expr.result !== 'success') throw new Error('KEY_EXPRESSION does not parse')
const onMap = (geohash: string, area: number) =>
  expr.value.evaluate({ zoom: 15 }, { type: 'Polygon', properties: { geohash, area_in_meters: area } } as never)

describe('buildingKey', () => {
  it.each([158.659, 37, 29.0258, 0.1, 1234567.891])('matches MapLibre to-string for area %d', (area) => {
    expect(buildingKey('e9w85srv', area)).toBe(`e9w85srv|${area}`)
    expect(onMap('e9w85srv', area)).toBe(buildingKey('e9w85srv', area))
  })
})
