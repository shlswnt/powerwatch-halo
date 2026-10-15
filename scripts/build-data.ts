import { createWriteStream, existsSync } from 'node:fs'
import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { DuckDBInstance } from '@duckdb/node-api'
import { buildingKey } from '../lib/building-key'
import { ringsFromNear } from '../lib/counts'
import { haversine, nearestTown } from '../lib/geo'
import { assignIds } from '../lib/ids'
import { parseKml } from '../lib/kml'
import { parseKva } from '../lib/kva'
import { sanityCheck } from '../lib/sanity'
import { TOWNS } from '../lib/towns'
import type { Meta, NearEntry, TownId, Transformer } from '../lib/types'

const KML_URL = 'https://www.google.com/maps/d/kml?mid=15-dhx6CVH8SnzaWYVy-AKVvZNaGpybY&forcekml=1'
const PARQUET_URL =
  'https://data.source.coop/vida/google-microsoft-open-buildings/geoparquet/by_country/country_iso=SLE/SLE.parquet'
const CACHE = 'data-cache'
const OUT = 'public/data'
const PARQUET = `${CACHE}/SLE.parquet`
// Prefilter half-widths in degrees; ≥ 500 m everywhere in Sierra Leone (lat 6.9–10°).
const DLAT = 0.0046
const DLON = 0.0047

async function download(url: string, path: string) {
  console.log(`Downloading ${url}`)
  const res = await fetch(url)
  if (!res.ok || !res.body) throw new Error(`Download failed: HTTP ${res.status} ${url}`)
  const tmp = `${path}.part`
  await pipeline(Readable.fromWeb(res.body as never), createWriteStream(tmp))
  await rename(tmp, path)
}

async function main() {
  await mkdir(CACHE, { recursive: true })

  // 1–4: transformers
  const kml = await fetch(KML_URL)
  if (!kml.ok) throw new Error(`KML download failed: HTTP ${kml.status}`)
  const { placemarks, warnings } = parseKml(await kml.text())
  for (const w of warnings) console.warn(`warn: ${w}`)
  const notes = [...warnings]
  const base = assignIds(placemarks).map((p) => {
    if (p.layer === 'freetown') return { ...p, town: 'freetown' as TownId }
    const { town, km } = nearestTown(p.lat, p.lon)
    if (km > 15) {
      const w = `"${p.name}" is ${km.toFixed(1)} km from the nearest town centre (${town.name})`
      console.warn(`warn: ${w}`)
      notes.push(w)
    }
    return { ...p, town: town.id }
  })
  console.log(`${base.length} transformers`)

  // 5: buildings within 500 m (prefilter in SQL, exact distance in TypeScript)
  if (!existsSync(PARQUET)) await download(PARQUET_URL, PARQUET)
  const db = await DuckDBInstance.create(':memory:')
  const c = await db.connect()
  await writeFile(`${CACHE}/transformers.csv`, 'idx,lat,lon\n' + base.map((t, i) => `${i},${t.lat},${t.lon}`).join('\n'))
  const cand = await c.runAndReadAll(`
    WITH b AS (
      SELECT file_row_number::INTEGER AS rid, geohash, area_in_meters AS area,
             (bf_source = 'google' AND confidence >= 0.75) AS hi,
             (bbox.ymin + bbox.ymax) / 2 AS lat,
             (bbox.xmin + bbox.xmax) / 2 AS lon
      FROM read_parquet('${PARQUET}', file_row_number = true))
    SELECT t.idx::INTEGER, b.rid, b.geohash, b.area, coalesce(b.hi, false), b.lat, b.lon
    FROM read_csv('${CACHE}/transformers.csv') t
    JOIN b ON b.lat BETWEEN t.lat - ${DLAT} AND t.lat + ${DLAT}
          AND b.lon BETWEEN t.lon - ${DLON} AND t.lon + ${DLON}`)

  const near: NearEntry[][] = base.map(() => [])
  const unique = new Set<number>()
  for (const [idx, rid, geohash, area, hi, lat, lon] of cand.getRowsJS() as [number, number, string, number, boolean, number, number][]) {
    const t = base[idx]
    const d = Math.round(haversine(t.lat, t.lon, lat, lon) * 10) / 10
    if (d > 500) continue
    near[idx].push([buildingKey(geohash, area), d, hi ? 1 : 0])
    unique.add(rid)
  }
  for (const list of near) list.sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))

  const transformers: Transformer[] = base.map((t, i) => ({
    id: t.id, name: t.name, layer: t.layer, town: t.town, lat: t.lat, lon: t.lon, description: t.description,
    kva: parseKva(t.description),
    rings: ringsFromNear(near[i]),
  }))

  // 6: sanity check before writing anything
  const problems = sanityCheck(transformers)
  if (problems.length) throw new Error(`Sanity check failed:\n  ${problems.join('\n  ')}`)
  console.log('Sanity check passed')

  // 7: outputs
  await rm(`${OUT}/t`, { recursive: true, force: true })
  await mkdir(`${OUT}/t`, { recursive: true })
  for (const [i, t] of base.entries()) await writeFile(`${OUT}/t/${t.id}.json`, JSON.stringify(near[i]))
  await writeFile(`${OUT}/transformers.json`, JSON.stringify(transformers))
  const meta: Meta = {
    builtAt: new Date().toISOString(),
    source: 'Google Open Buildings v3 + Microsoft Building Footprints, merged by VIDA (Sierra Leone)',
    transformerCount: transformers.length,
    buildingCount: unique.size,
    warnings: notes,
  }
  await writeFile(`${OUT}/meta.json`, JSON.stringify(meta, null, 2))

  const perTown = TOWNS.map((t) => `${t.name} ${transformers.filter((x) => x.town === t.id).length}`)
  console.log(`Done. ${unique.size} buildings. ${perTown.join(' · ')}`)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
