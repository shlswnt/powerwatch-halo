'use client'

import 'maplibre-gl/dist/maplibre-gl.css'
import { Globe, MapPin, Maximize, Minus, Plus } from 'lucide-react'
import { addProtocol, setWorkerUrl } from 'maplibre-gl'
import { Protocol } from 'pmtiles'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import Map, { Layer, Marker, Source, type MapLayerMouseEvent, type MapRef } from 'react-map-gl/maplibre'
import type { FeatureCollection, Point, Polygon } from 'geojson'
import { toast } from 'sonner'
import { MAP_BUTTON, MAP_PILL_BUTTON, MAP_SURFACE, PANEL_SURFACE } from '@/components/map-chrome'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger } from '@/components/ui/select'
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
// The device asks for less motion, or the Reduce motion setting is on: the camera jumps instead of flying.
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduce'
const motion = (ms: number) => (reducedMotion() ? 0 : ms)

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
  /** Height (px) of the details pane currently covering the map's bottom edge, with its inset (0 when hidden or on phones). */
  bottomInset: number
  /** The same when open, so a camera move made as it opens already frames the map above it. */
  panelHeight: number
  /** Button placed before the breadcrumb (the sidebar trigger). */
  leading?: ReactNode
}

export default function MapView({ transformers, visible, settings, view, tint, camera, loading, onPick, onToggle, onTown, onIssue, onFit, controls, bottomInset, panelHeight, leading }: Props) {
  const ref = useRef<MapRef>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  // The map is a fixed 100vw wide, right-aligned, so opening/closing the sidebar slides over it instead of resizing the
  // canvas every frame. This is the strip of map currently hidden under the sidebar on the left.
  const hiddenLeft = () => Math.max(0, (ref.current?.getContainer().clientWidth ?? 0) - (wrapRef.current?.clientWidth ?? 0))
  const zoomBy = (dir: 1 | -1) => {
    const map = ref.current
    if (!map) return
    const c = map.getContainer()
    const around = map.unproject([(hiddenLeft() + c.clientWidth) / 2, (c.clientHeight - bottomInset) / 2])
    // A real duration, never undefined: MapLibre copies an explicit undefined over its default and the ease ends at NaN.
    map.easeTo({ zoom: map.getZoom() + dir, around, duration: motion(500) })
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

  // Closing the credits: MapLibre hides them on click at once, so catch that click, slide them back into the "i" circle
  // (attrib-slide-in in globals.css), then replay the click for MapLibre. Opening is left to MapLibre (attrib-slide-out).
  useEffect(() => {
    if (!loaded) return
    const box = ref.current?.getContainer().querySelector<HTMLElement>('.maplibregl-ctrl-attrib')
    const button = box?.querySelector<HTMLElement>('.maplibregl-ctrl-attrib-button')
    if (!box || !button) return
    let replaying = false
    const onClick = (e: MouseEvent) => {
      if (replaying || !button.contains(e.target as Node) || !box.classList.contains('maplibregl-compact-show')) return
      e.preventDefault()
      e.stopPropagation()
      if (box.classList.contains('attrib-closing')) return
      let done = false
      const close = () => {
        if (done) return
        done = true
        box.classList.remove('attrib-closing')
        replaying = true
        button.click()
        replaying = false
      }
      if (reducedMotion()) return close()
      box.classList.add('attrib-closing')
      // Never let the close hang on the animation: if none started (styles missing or blocked), close now; otherwise
      // close when it ends, with a timer in case that event never comes.
      if (!box.getAnimations().some((a) => (a as CSSAnimation).animationName === 'attrib-slide-in')) return close()
      box.addEventListener('animationend', close, { once: true })
      setTimeout(close, 400)
    }
    box.addEventListener('click', onClick, true)
    return () => box.removeEventListener('click', onClick, true)
  }, [loaded])

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
    // The details pane (desktop, along the bottom) or the phone's third-height sheet covers the bottom of the map; pad
    // camera moves to land in the rest.
    const opensPanel = camera.kind === 'transformer' || camera.kind === 'selection'
    const desktop = window.matchMedia('(min-width: 1024px)').matches
    const pad = {
      top: 0,
      left: hiddenLeft(),
      right: 0,
      bottom: desktop ? (opensPanel ? Math.max(bottomInset, panelHeight) : bottomInset) : opensPanel ? Math.round(window.innerHeight / 3) : 0,
    }
    const around = (px: number) => ({ top: pad.top + px, left: pad.left + px, right: pad.right + px, bottom: pad.bottom + px })
    // Padding is always animated as part of the move (absolutePadding on fits), never reset first: resetting it shifted
    // the view in one frame before the flight began.
    const fitTo = (ts: Transformer[], maxZoom: number) => {
      const lons = ts.map((t) => t.lon)
      const lats = ts.map((t) => t.lat)
      map.fitBounds([[Math.min(...lons) - 0.005, Math.min(...lats) - 0.005], [Math.max(...lons) + 0.005, Math.max(...lats) + 0.005]], { padding: around(48), absolutePadding: true, duration: motion(1200), maxZoom })
    }
    if (camera.kind === 'country') map.fitBounds(SIERRA_LEONE, { padding: around(24), absolutePadding: true, duration: camera.seq ? motion(800) : 0 })
    if (camera.kind === 'transformer') {
      const t = byId.get(camera.id)
      if (t) map.flyTo({ center: [t.lon, t.lat], zoom: 15.5, duration: motion(1200), padding: pad })
    }
    if (camera.kind === 'town') {
      const ts = transformers.filter((t) => t.town === camera.town)
      if (!ts.length) {
        const c = townById(camera.town)
        map.flyTo({ center: [c.lon, c.lat], zoom: 12, duration: motion(1200), padding: pad })
      } else fitTo(ts, 15)
    }
    if (camera.kind === 'selection') {
      const ts = camera.ids.map((id) => byId.get(id)).filter((t): t is Transformer => !!t)
      if (ts.length) fitTo(ts, 15.5)
    }
    // camera.seq is the trigger (re-run once the map has loaded, so a request made earlier isn't lost); other deps are read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera.seq, loaded])


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
  // Recolouring the footprints re-evaluates a match over thousands of buildings on the main thread. Mid-flight that
  // stalls the camera (a visible jump) and the pane's animations, so a new colouring waits until the camera stops.
  const [shownPaint, setShownPaint] = useState(paint)
  useEffect(() => {
    const map = ref.current
    const apply = () => setShownPaint(paint)
    if (!map?.isMoving()) return apply()
    map.once('moveend', apply)
    return () => { map.off('moveend', apply) }
  }, [paint])

  const status = loading ? 'Loading transformers…'
    : buildingsFailed ? 'Building footprints could not load — counts still shown.' : null
  const [shownStatus, setShownStatus] = useState(status)
  if (status && status !== shownStatus) setShownStatus(status)

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
        <ControlColumn>{controls}</ControlColumn>
      </div>
    )
  }

  return (
    // --bottom-inset lifts MapLibre's attribution (bottom-right) clear of the details pane; see globals.css.
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden" style={{ '--bottom-inset': `${bottomInset}px` } as CSSProperties}>
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
              paint={{ 'fill-color': shownPaint.fillColor as never, 'fill-opacity': shownPaint.fillOpacity as never }} />
            <Layer id="footprints-line" type="line" source-layer={BUILDINGS_LAYER} minzoom={15}
              paint={{ 'line-color': shownPaint.lineColor as never, 'line-width': 1 }} />
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
            // Keyed by transformer too, so the labels fade in afresh for each one (and as zooming makes room for them).
            <Marker key={`${single.id}-${r}`} longitude={lon} latitude={lat} anchor="center">
              <span data-testid="ring-label" className="pointer-events-none block animate-in fade-in zoom-in-90 duration-300 rounded-full bg-[rgba(10,10,10,0.82)] px-1.5 font-mono text-[11px] font-medium leading-[18px]" style={{ color: BAND_COLORS[i] }}>{r} m</span>
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
        <div key={hovered.id} className={cn(MAP_SURFACE, 'pointer-events-none absolute z-30 flex animate-in fade-in zoom-in-95 duration-150 flex-col gap-0.5 whitespace-nowrap rounded-lg px-3 py-2')}
          style={{ left: Math.max(8, hover.x + 14), top: Math.max(8, hover.y - 54) }}>
          <span className="text-[13px] font-semibold">{hovered.name}</span>
          <span className="text-xs text-[var(--map-muted)]">{total500(hovered).toLocaleString('en-US')} buildings ≤500 m · {townById(hovered.town).name}</span>
        </div>
      )}

      <MapOverlays leading={leading} selected={selected} single={single} town={view.town} onTown={onTown} all={transformers} />

      {/* Top centre of the uncovered map, under the breadcrumb, clear of a floating details card; it wraps rather than run
          under the card when the uncovered map is narrow. Always mounted (a live region should exist before it speaks), it
          fades and drops in and out with CSS, keeping its last message while it fades out. */}
      <div role="status" aria-hidden={!status}
        className={cn(CHROME, 'pointer-events-none absolute top-20 z-30 flex w-max -translate-x-1/2 items-center gap-2 rounded-2xl px-3.5 py-2 text-[12.5px]',
          'transition-[opacity,translate] duration-200 ease-out motion-reduce:transition-none', status ? 'translate-y-0 opacity-100' : '-translate-y-1.5 opacity-0')}
        style={{ left: '50%', maxWidth: 'calc(100% - 20px)' }}>
        <span className="size-2 shrink-0 rounded-full bg-[#38bdf8]" />{shownStatus}
      </div>

      <ControlColumn>
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
function ControlColumn({ children }: { children: ReactNode }) {
  return <div className="absolute right-[10px] top-[10px] z-30 flex flex-col items-end gap-7">{children}</div>
}

interface OverlayProps {
  leading?: ReactNode
  selected: Transformer[]
  single: Transformer | null
  town: TownId | null
  onTown: (town: TownId | null) => void
  /** Every transformer, for the city picker's counts. */
  all: Transformer[]
}

/** One city option: a leading icon, the name, and its transformer count right-aligned (none when not yet surveyed). */
function CityItem({ value, label, n, icon }: { value: string; label: string; n: number; icon: ReactNode }) {
  return (
    <SelectItem value={value} className={cn('gap-2.5 rounded-md py-2 pl-2 pr-8 [&_svg]:text-muted-foreground', n === 0 && 'text-muted-foreground')}>
      {icon}
      <span className="truncate">{label}</span>
      {n > 0 && <span className="ml-auto self-center pl-3 font-mono text-xs tabular-nums text-muted-foreground">{n.toLocaleString('en-US')}</span>}
    </SelectItem>
  )
}

function CityGroup({ label, cities }: { label: string; cities: { value: string; label: string; n: number }[] }) {
  return (
    <SelectGroup className="p-0">
      <SelectLabel className="px-2 pb-1 pt-1.5 font-medium">{label}</SelectLabel>
      {cities.map((c) => <CityItem key={c.value} {...c} icon={<MapPin />} />)}
    </SelectGroup>
  )
}

function MapOverlays({ leading, selected, single, town, onTown, all }: OverlayProps) {
  // Cities by transformer count (from cityOptions, minus its "All cities" entry).
  const cities = cityOptions(all).slice(1).map((o) => { const [label, n] = o.label.split(' · '); return { value: o.value, label, n: Number(n) } })
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
              className={`w-64 p-1.5 ring-0 ${PANEL_SURFACE}`}>
              <CityItem value="all" label="All cities" n={all.length} icon={<Globe />} />
              <SelectSeparator className="-mx-1.5 my-1.5" />
              <CityGroup label="Surveyed" cities={cities.filter((c) => c.n > 0)} />
              {cities.some((c) => c.n === 0) && <>
                <SelectSeparator className="-mx-1.5 my-1.5" />
                <CityGroup label="Not yet surveyed" cities={cities.filter((c) => c.n === 0)} />
              </>}
            </SelectContent>
          </Select>
          {name && <>
            <span role="separator" aria-orientation="vertical" className="mx-1 h-4 w-px shrink-0 animate-in fade-in bg-[var(--map-border)]" />
            <span key={name} data-testid="crumb-name" className="truncate animate-in fade-in slide-in-from-left-1 duration-300">{name}</span>
          </>}
        </div>
      </div>
      </div>
    </>
  )
}
