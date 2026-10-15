'use client'

import 'maplibre-gl/dist/maplibre-gl.css'
import { Maximize, Minus, Plus } from 'lucide-react'
import { addProtocol, setWorkerUrl } from 'maplibre-gl'
import { Protocol } from 'pmtiles'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import Map, { Layer, Marker, Source, type MapLayerMouseEvent, type MapRef } from 'react-map-gl/maplibre'
import type { FeatureCollection, Point, Polygon } from 'geojson'
import { toast } from 'sonner'
import { MAP_BUTTON, MAP_PILL_BUTTON, MAP_SURFACE, PANEL_SURFACE, SLIDE } from '@/components/map-chrome'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { cityOptions, total500 } from '@/lib/list'
import {
  BAND_COLORS, BUILDINGS_ATTRIBUTION, BUILDINGS_LAYER, BUILDINGS_URL, bandRings, footprintPaint, imageryStyle, northOf, ringPixels,
} from '@/lib/map-style'
import type { NoteInput } from '@/lib/notifications'
import type { Settings } from '@/lib/settings'
import { townById } from '@/lib/towns'
import { BANDS, type TownId, type Transformer } from '@/lib/types'
import type { ViewState } from '@/lib/url-state'
import { cn } from '@/lib/utils'

// Once per page (this module only ever loads in the browser): register pmtiles:// and point MapLibre at its
// worker, which npm's predev/prebuild copy into public/ because bundlers can't see MapLibre's dynamic worker URL.
const g = globalThis as { __pmtiles?: boolean }
if (!g.__pmtiles) {
  setWorkerUrl('/maplibre-gl-worker.mjs')
  addProtocol('pmtiles', new Protocol().tile)
  g.__pmtiles = true
}

export type CameraTarget =
  | { kind: 'country' }
  | { kind: 'town'; town: TownId }
  | { kind: 'transformer'; id: string }
  | { kind: 'selection'; ids: string[] }
export type Camera = CameraTarget & { seq: number }
export interface Tint {
  bands: ReadonlyMap<string, number> | null
  shared: string[]
}

const SIERRA_LEONE: [[number, number], [number, number]] = [[-13.35, 6.9], [-10.25, 10.0]]
const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
const BAND_MATCH = ['match', ['get', 'band'], 0, BAND_COLORS[0], 1, BAND_COLORS[1], 2, BAND_COLORS[2], 3, BAND_COLORS[3], BAND_COLORS[4]]
/** Map chrome sits on imagery, so it is dark in both themes (spec §7). */
/** Non-button overlays get the same corner, border and shadow as the map buttons. */
const CHROME = `rounded-lg shadow-sm ${MAP_SURFACE}`

interface Props {
  transformers: Transformer[]
  visible: Transformer[]
  settings: Settings
  view: ViewState
  tint: Tint
  camera: Camera
  loading: boolean
  onPick: (id: string) => void
  onToggle: (id: string) => void
  onTown: (town: TownId | null) => void
  onIssue: (n: NoteInput) => void
  onFit: () => void
  /** Panel button and notifications bell, stacked above the zoom pill. */
  controls: ReactNode
  /** Width (px) of the right panel currently covering the map's right edge (0 when hidden or on phones). */
  rightInset: number
  panelWidth: number
  /** Button placed before the breadcrumb (the sidebar trigger). */
  leading?: ReactNode
}

export default function MapView({ transformers, visible, settings, view, tint, camera, loading, onPick, onToggle, onTown, onIssue, onFit, controls, rightInset, panelWidth, leading }: Props) {
  const ref = useRef<MapRef>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  // The map is a fixed 100vw wide, right-aligned, so opening/closing the sidebar slides over it instead of resizing the
  // canvas every frame. This is the strip of map currently hidden under the sidebar on the left.
  const hiddenLeft = () => Math.max(0, (ref.current?.getContainer().clientWidth ?? 0) - (wrapRef.current?.clientWidth ?? 0))
  const zoomBy = (dir: 1 | -1) => {
    const map = ref.current
    if (!map) return
    const c = map.getContainer()
    const around = map.unproject([(hiddenLeft() + c.clientWidth) / 2, c.clientHeight / 2])
    map.easeTo({ zoom: map.getZoom() + dir, around })
  }
  const warnedBuildings = useRef(false)
  const [failed, setFailed] = useState<string | null>(TOKEN ? null : 'Map unavailable: NEXT_PUBLIC_MAPBOX_TOKEN is not set.')
  const [buildingsFailed, setBuildingsFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [zoom, setZoom] = useState(7)
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null)
  useEffect(() => {
    if (failed) onIssue({ id: 'map-unavailable', severity: 'error', message: failed })
  }, [failed, onIssue])

  const byId = useMemo(() => new globalThis.Map(transformers.map((t) => [t.id, t])), [transformers])
  const selectedKey = view.selected.join(',')
  const selected = useMemo(() => view.selected.map((id) => byId.get(id)).filter((t): t is Transformer => !!t),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedKey, byId])
  const single = !view.overlap && selected.length === 1 ? selected[0] : null
  const comparing = selected.length > 1
  const mapStyle = useMemo(() => imageryStyle(TOKEN ?? '', settings.labels), [settings.labels])

  useEffect(() => {
    const map = ref.current
    if (!map || !loaded) return
    map.resize()
    // A floating details card or the phone's half-height sheet covers part of the map; pad moves to land in the rest.
    const opensPanel = camera.kind === 'transformer' || camera.kind === 'selection'
    const desktop = window.matchMedia('(min-width: 1024px)').matches
    const pad = {
      top: 0,
      left: hiddenLeft(),
      right: desktop ? (opensPanel ? Math.max(rightInset, panelWidth) : rightInset) : 0,
      bottom: !desktop && opensPanel ? Math.round(window.innerHeight * 0.5) : 0,
    }
    const around = (px: number) => ({ top: pad.top + px, left: pad.left + px, right: pad.right + px, bottom: pad.bottom + px })
    map.setPadding({ top: 0, right: 0, bottom: 0, left: 0 })
    const fitTo = (ts: Transformer[], maxZoom: number) => {
      const lons = ts.map((t) => t.lon)
      const lats = ts.map((t) => t.lat)
      map.fitBounds([[Math.min(...lons) - 0.005, Math.min(...lats) - 0.005], [Math.max(...lons) + 0.005, Math.max(...lats) + 0.005]], { padding: around(48), duration: 1200, maxZoom })
    }
    if (camera.kind === 'country') map.fitBounds(SIERRA_LEONE, { padding: around(24), duration: camera.seq ? 800 : 0 })
    if (camera.kind === 'transformer') {
      const t = byId.get(camera.id)
      if (t) map.flyTo({ center: [t.lon, t.lat], zoom: 15.5, duration: 1200, padding: pad })
    }
    if (camera.kind === 'town') {
      const ts = transformers.filter((t) => t.town === camera.town)
      if (!ts.length) {
        const c = townById(camera.town)
        map.flyTo({ center: [c.lon, c.lat], zoom: 12, duration: 1200, padding: pad })
      } else fitTo(ts, 15)
    }
    if (camera.kind === 'selection') {
      const ts = camera.ids.map((id) => byId.get(id)).filter((t): t is Transformer => !!t)
      if (ts.length) fitTo(ts, 15.5)
    }
    // camera.seq is the trigger (re-run once the map has loaded, so a request made earlier isn't lost); other deps are read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera.seq, loaded])

  // A details card narrows the map, and MapLibre's open credits box would then cover the legend: collapse it while a
  // card is open. The (i) button still opens it on request.
  useEffect(() => {
    if (!loaded || rightInset === 0) return
    const attrib = ref.current?.getContainer().querySelector('.maplibregl-ctrl-attrib')
    attrib?.classList.remove('maplibregl-compact-show')
    attrib?.removeAttribute('open')
  }, [loaded, rightInset])

  const dots = useMemo<FeatureCollection<Point>>(() => ({
    type: 'FeatureCollection',
    features: visible.filter((t) => !view.selected.includes(t.id)).map((t) => ({ type: 'Feature', properties: { id: t.id }, geometry: { type: 'Point', coordinates: [t.lon, t.lat] } })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [visible, selectedKey])
  const chosen = useMemo<FeatureCollection<Point>>(() => ({
    type: 'FeatureCollection',
    features: selected.map((t) => ({ type: 'Feature', properties: { id: t.id }, geometry: { type: 'Point', coordinates: [t.lon, t.lat] } })),
  }), [selected])
  const rings = useMemo<FeatureCollection<Polygon, { band: number }>>(() => ({
    type: 'FeatureCollection',
    features: selected.flatMap((t) => bandRings(t.lat, t.lon).features),
  }), [selected])
  const hovered = hover && !view.selected.includes(hover.id) ? byId.get(hover.id) ?? null : null
  const hoverRings = useMemo(() => (hovered ? bandRings(hovered.lat, hovered.lon) : null), [hovered])
  const paint = useMemo(() => footprintPaint(tint.bands, tint.shared, comparing), [tint, comparing])

  const status = loading ? 'Loading transformers…'
    : buildingsFailed ? 'Building footprints could not load — counts still shown.' : null

  function onClick(e: MapLayerMouseEvent) {
    const id = e.features?.[0]?.properties?.id
    if (!id) return
    const o = e.originalEvent
    if (o.shiftKey || o.metaKey || o.ctrlKey) onToggle(String(id))
    else onPick(String(id))
  }
  function onMouseMove(e: MapLayerMouseEvent) {
    const id = e.features?.[0]?.properties?.id
    if (id) setHover({ id: String(id), x: e.point.x - hiddenLeft(), y: e.point.y })
    else if (hover) setHover(null)
  }

  if (failed) {
    return (
      <div className="relative flex h-full w-full items-center justify-center bg-muted p-6 text-center text-sm text-muted-foreground" role="alert">
        {failed} The list and counts still work.
        {/* Keep notifications reachable when the map itself is down. */}
        <ControlColumn offset={0}>{controls}</ControlColumn>
      </div>
    )
  }

  return (
    // --right-inset slides MapLibre's attribution (bottom-right) clear of a floating details card; see globals.css.
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden" style={{ '--right-inset': `${rightInset}px` } as CSSProperties}>
      <Map
        ref={ref}
        initialViewState={{ bounds: SIERRA_LEONE, fitBoundsOptions: { padding: 24 } }}
        mapStyle={mapStyle}
        style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: '100vw' }}
        dragRotate={false}
        attributionControl={{ compact: true }}
        pitchWithRotate={false}
        touchPitch={false}
        interactiveLayerIds={['transformer-dots', 'selected-dots']}
        onClick={onClick}
        onMouseMove={onMouseMove}
        onMouseLeave={() => setHover(null)}
        cursor={hover ? 'pointer' : 'grab'}
        onLoad={(e) => {
          setLoaded(true)
          setZoom(e.target.getZoom())
        }}
        onZoomEnd={(e) => setZoom(e.viewState.zoom)}
        onError={(e) => {
          const err = e.error as { message?: string; status?: number } | undefined
          const sourceId = (e as unknown as { sourceId?: string }).sourceId
          if (/webgl/i.test(String(err?.message))) setFailed('Map unavailable: this browser does not support WebGL.')
          else if (sourceId === 'imagery' && (err?.status === 401 || err?.status === 403)) setFailed('Map unavailable: Mapbox rejected the access token.')
          else if (sourceId === 'buildings' && !warnedBuildings.current) {
            warnedBuildings.current = true
            setBuildingsFailed(true)
            toast.error("Building outlines couldn't load. Counts still work.")
            onIssue({ id: 'buildings-outlines', severity: 'warning', message: "Building outlines couldn't load from VIDA (source.coop). Counts, rings and the list still work." })
          } else console.error(e.error)
        }}
      >
        {settings.footprints && (
          <Source id="buildings" type="vector" url={BUILDINGS_URL} attribution={BUILDINGS_ATTRIBUTION}>
            <Layer id="footprints" type="fill" source-layer={BUILDINGS_LAYER} minzoom={15}
              paint={{ 'fill-color': paint.fillColor as never, 'fill-opacity': paint.fillOpacity as never }} />
            <Layer id="footprints-line" type="line" source-layer={BUILDINGS_LAYER} minzoom={15}
              paint={{ 'line-color': paint.lineColor as never, 'line-width': 1 }} />
          </Source>
        )}
        {settings.rings && rings.features.length > 0 && (
          <Source id="rings" type="geojson" data={rings}>
            <Layer id="rings-fill" type="fill" paint={{ 'fill-color': BAND_MATCH as never, 'fill-opacity': single ? 0.05 : 0 }} />
            <Layer id="rings-line" type="line" paint={{ 'line-color': BAND_MATCH as never, 'line-opacity': 0.95, 'line-width': 1.75 }} />
          </Source>
        )}
        {settings.rings && hoverRings && (
          <Source id="hover-rings" type="geojson" data={hoverRings}>
            <Layer id="hover-rings-line" type="line" paint={{ 'line-color': BAND_MATCH as never, 'line-opacity': 0.6, 'line-width': 1.5, 'line-dasharray': [3, 3] }} />
          </Source>
        )}
        <Source id="transformers" type="geojson" data={dots}>
          <Layer id="transformer-dots" type="circle" paint={{
            'circle-radius': ['step', ['zoom'], 3.5, 11, 5, 14, 6.5],
            'circle-color': ['case', ['==', ['get', 'id'], hover?.id ?? ''], '#ffffff', '#e5e5e5'],
            'circle-stroke-color': 'rgba(10,10,10,0.85)',
            'circle-stroke-width': 1.5,
          }} />
        </Source>
        <Source id="selected" type="geojson" data={chosen}>
          <Layer id="selected-dots" type="circle" paint={{ 'circle-radius': 8, 'circle-color': '#fafafa', 'circle-stroke-color': 'rgba(10,10,10,0.9)', 'circle-stroke-width': 3 }} />
          <Layer id="selected-centres" type="circle" paint={{ 'circle-radius': 3.2, 'circle-color': '#0a0a0a' }} />
        </Source>
        {single && settings.rings && BANDS.map((r, i) => {
          if (ringPixels(r, single.lat, zoom) < 46) return null
          const [lon, lat] = northOf(single.lat, single.lon, r)
          return (
            <Marker key={r} longitude={lon} latitude={lat} anchor="center">
              <span className="pointer-events-none rounded-full bg-[rgba(10,10,10,0.82)] px-1.5 font-mono text-[11px] font-medium leading-[18px]" style={{ color: BAND_COLORS[i] }}>{r} m</span>
            </Marker>
          )
        })}
        {zoom >= 13 && selected.map((t) => (
          <Marker key={t.id} longitude={t.lon} latitude={t.lat} anchor="left" offset={[14, 0]}>
            <span className="pointer-events-none whitespace-nowrap rounded-md bg-[rgba(10,10,10,0.88)] px-2 text-xs font-semibold leading-[22px] text-[#fafafa]">{t.name}</span>
          </Marker>
        ))}
      </Map>

      {hovered && hover && (
        <div className={cn(MAP_SURFACE, 'pointer-events-none absolute z-30 flex flex-col gap-0.5 whitespace-nowrap rounded-[10px] px-3 py-2')}
          style={{ left: Math.max(8, hover.x + 14), top: Math.max(8, hover.y - 54) }}>
          <span className="text-[13px] font-semibold">{hovered.name}</span>
          <span className="text-xs text-[var(--map-muted)]">{total500(hovered).toLocaleString('en-US')} buildings ≤500 m · {townById(hovered.town).name}</span>
        </div>
      )}

      <MapOverlays leading={leading} selected={selected} single={single} town={view.town} comparing={comparing} radius={view.radius} onTown={onTown} all={transformers} />

      {status && (
        // Top centre of the uncovered map, under the breadcrumb: clear of the legend and of a floating details card.
        // It wraps rather than run under the card when the uncovered map is narrow.
        <div role="status" className={cn(CHROME, 'absolute top-20 z-30 flex w-max -translate-x-1/2 items-center gap-2 rounded-2xl px-3.5 py-2 text-[12.5px]')}
          style={{ left: `calc((100% - ${rightInset}px) / 2)`, maxWidth: `calc(100% - ${rightInset}px - 20px)` }}>
          <span className="size-2 shrink-0 rounded-full bg-[#38bdf8]" />{status}
        </div>
      )}

      <ControlColumn offset={rightInset}>
        {controls}
        {/* Zoom in / out joined in one pill; fit to selection on its own just below. */}
        <div className="flex flex-col gap-2.5">
          <div data-testid="zoom-pill" className={cn(MAP_SURFACE, 'flex flex-col overflow-hidden rounded-lg shadow-sm')}>
            <Button size="icon" variant="ghost" className={MAP_PILL_BUTTON} aria-label="Zoom in" onClick={() => zoomBy(1)}><Plus /></Button>
            <div className="h-px bg-[var(--map-border)]" />
            <Button size="icon" variant="ghost" className={MAP_PILL_BUTTON} aria-label="Zoom out" onClick={() => zoomBy(-1)}><Minus /></Button>
          </div>
          <Button size="icon" variant="ghost" className={cn(MAP_BUTTON, 'shadow-sm')} aria-label="Fit to selection" onClick={onFit}><Maximize /></Button>
        </div>
      </ControlColumn>
    </div>
  )
}

/** Top-right column: the bell, then the zoom pill and fit button — spaced apart as in the reference video. */
function ControlColumn({ children, offset }: { children: ReactNode; offset: number }) {
  return (
    <div className={cn('absolute right-[10px] top-[10px] z-30 flex flex-col items-end gap-7', SLIDE)} style={{ transform: `translateX(${-offset}px)` }}>
      {children}
    </div>
  )
}

interface OverlayProps {
  leading?: ReactNode
  selected: Transformer[]
  single: Transformer | null
  town: TownId | null
  comparing: boolean
  radius: number
  onTown: (town: TownId | null) => void
  /** Every transformer, for the city picker's counts. */
  all: Transformer[]
}

function MapOverlays({ leading, selected, single, town, comparing, radius, onTown, all }: OverlayProps) {
  const townId = single?.town ?? town
  const name = single?.name ?? (selected.length > 1 ? `${selected.length} selected` : selected[0]?.name)
  return (
    <>
      <div className="absolute left-[10px] top-[10px] z-30 flex max-w-[calc(100%-120px)] items-start gap-2">
      {leading}
      <div data-testid="map-breadcrumb" className={cn(CHROME, 'flex h-11 min-w-0 items-center gap-2 whitespace-nowrap px-3.5')}>
        <div className="flex min-w-0 items-center gap-1.5 text-sm font-semibold">
          {/* The city name is the city picker; its list drops down below the pill, styled like the cards. */}
          <Select value={townId ?? 'all'} onValueChange={(v) => onTown(v === 'all' ? null : (v as TownId))}>
            <SelectTrigger aria-label="City"
              className="h-auto shrink-0 gap-1 rounded border-0 bg-transparent p-0 font-medium text-[var(--map-muted)] hover:text-[var(--map-fg)] dark:bg-transparent dark:hover:bg-transparent [&_svg]:size-3.5 [&_svg]:text-current">
              {townId ? townById(townId).name : 'Sierra Leone'}
            </SelectTrigger>
            {/* 12 px clears the rest of the 44 px pill below the 20 px trigger; then a 6 px gap. */}
            <SelectContent alignItemWithTrigger={false} align="start" alignOffset={-14} sideOffset={18}
              className={`w-56 p-1 ring-0 ${PANEL_SURFACE}`}>
              {cityOptions(all).map((o) => {
                const [label, count] = o.label.split(' · ')
                return (
                  <SelectItem key={o.value} value={o.value}>
                    {label}<span className="ml-auto font-mono text-xs text-muted-foreground">{count}</span>
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
          {name && <><span role="separator" aria-orientation="vertical" className="mx-1 h-4 w-px shrink-0 bg-[var(--map-border)]" /><span className="truncate">{name}</span></>}
        </div>
      </div>
      </div>
      {/* A narrow column, 10 px from the bottom, level with MapLibre's attribution button (globals.css). */}
      <div data-testid="band-legend" className={cn(MAP_SURFACE, 'pointer-events-none absolute bottom-[10px] left-[10px] z-30 flex flex-col items-start gap-1.5 rounded-lg px-2.5 py-2')}>
        {BANDS.map((b, i) => (
          <span key={b} className="flex items-center gap-1.5 whitespace-nowrap text-xs">
            <span className="size-2.5 rounded-full border-2" style={{ borderColor: BAND_COLORS[i] }} />
            <span className="font-mono">{b} m</span>
          </span>
        ))}
        {comparing && (
          <span className="flex items-center gap-1.5 whitespace-nowrap text-xs">
            <span className="size-2.5 rounded-sm border border-[var(--map-border)] bg-white" />Shared ≤{radius} m
          </span>
        )}
      </div>
    </>
  )
}
