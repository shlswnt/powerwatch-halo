import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { assignIds, baseId } from './ids'
import { cleanDescription, parseKml } from './kml'

const xml = readFileSync(new URL('./__fixtures__/sample.kml', import.meta.url), 'utf8')

describe('parseKml', () => {
  const { placemarks, warnings } = parseKml(xml)

  it('keeps Point placemarks from the two layers only', () => {
    expect(placemarks.map((p) => p.name)).toEqual(['Africanus Road', 'Unnamed transformer', 'Bo Inn Hotel', 'Twin A', 'Twin B'])
    expect(placemarks.map((p) => p.layer)).toEqual(['freetown', 'freetown', 'outside', 'outside', 'outside'])
  })
  it('parses coordinates with surrounding whitespace', () =>
    expect(placemarks[0]).toMatchObject({ lat: 8.4768096, lon: -13.198767 }))
  it('warns about the non-Point placemark by name', () => {
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('Feeder line')
  })
  it('turns HTML descriptions into plain text', () => {
    expect(placemarks[0].description).toBe('1000kva transformer\nby Leoneco filling station & fisher lane')
    expect(placemarks[2].description).toBe('Bo Inn transformer. Capacity 400kva.\n\ntransformer_functional - Yes')
    expect(placemarks[1].description).toBe('')
  })
  it('throws when a required layer is missing', () =>
    expect(() => parseKml(xml.replace('Freetown - Transformers', 'Renamed'))).toThrow('Missing KML layer "Freetown - Transformers"'))
})

describe('cleanDescription', () => {
  it('decodes entities and collapses blank lines', () =>
    expect(cleanDescription('a&nbsp;b<br><br><br><br><b>c</b> &lt;d&gt;')).toBe('a b\n\nc <d>'))
})

describe('ids', () => {
  it('baseId is 8 hex chars and deterministic', () => {
    expect(baseId('freetown', 8.4768096, -13.198767)).toMatch(/^[0-9a-f]{8}$/)
    expect(baseId('freetown', 8.4768096, -13.198767)).toBe(baseId('freetown', 8.4768096, -13.198767))
  })
  it('ignores digits past the 6th decimal', () =>
    expect(baseId('outside', 8.47680961, -13.1987671)).toBe(baseId('outside', 8.4768096, -13.198767)))
  it('differs by layer', () => expect(baseId('freetown', 8.1, -13.1)).not.toBe(baseId('outside', 8.1, -13.1)))
  it('suffixes exact duplicates in document order', () => {
    const ids = assignIds(parseKml(xml).placemarks).map((p) => p.id)
    expect(ids[4]).toBe(`${ids[3]}-2`)
    expect(new Set(ids).size).toBe(5)
  })
})
