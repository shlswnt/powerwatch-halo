# PowerWatch Halo

Buildings within 100–500 m of Sierra Leone transformers, on satellite imagery.
Spec: `docs/superpowers/specs/2026-10-14-transformer-building-counts-design.md`.

## Setup

```bash
npm install
cp .env.example .env.local   # add the public Mapbox token
npm run data                 # fetch KML + buildings, write public/data/
npm run dev
```

Re-run `npm run data` after adding or moving pins in the My Maps layers.
Imagery: Mapbox satellite-streets (raster tiles, public token). Building outlines: VIDA's hosted PMTiles on source.coop, matched to our counts by `geohash|area`.
Layout: Transformer reach — list (City, Sort, Compare, CSV) on the left, details on the right (overview, transformer waterfall chart and band table, overlap tables).

## Tests

- `npm test` — unit tests
- `npm run build && npm run e2e` — smoke test (desktop + mobile)

## Deploy (Vercel)

Import the repo in Vercel (framework: Next.js). Set `NEXT_PUBLIC_MAPBOX_TOKEN`; ask the Mapbox account owner to restrict that token to the Vercel domain(s). `public/data/` must be present in the deployed source (run `npm run data` before deploying).
