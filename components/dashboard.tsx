'use client'

import dynamic from 'next/dynamic'
import { usePathname, useSearchParams } from 'next/navigation'
import { Check, Link2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { toast } from 'sonner'
import { AppSidebar, MobileSidebar } from '@/components/app-sidebar'
import { OverlapDetails } from '@/components/details/overlap'
import { TransformerDetails } from '@/components/details/transformer'
import { MAP_BUTTON, PANEL_SURFACE, SLIDE } from '@/components/map-chrome'
import type { Camera, CameraTarget, Tint } from '@/components/map-view'
import { NotificationsButton } from '@/components/notifications'
import { SettingsDialog } from '@/components/settings-dialog'
import { TransformerList } from '@/components/transformer-list'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { SidebarInset, SidebarProvider, SidebarTrigger, useSidebar } from '@/components/ui/sidebar'
import { useIsMobile } from '@/hooks/use-mobile'
import { compareStats, compareTint } from '@/lib/compare'
import { loadMeta, loadNear, loadTransformers } from '@/lib/data'
import { filterTransformers, nearbyIds, sortTransformers, stepInList, toCsv, type SortKey } from '@/lib/list'
import { singleBands } from '@/lib/map-style'
import { EMPTY_NOTES, addNote, clearNotes, markRead, type NoteInput } from '@/lib/notifications'
import { clearSelection, openTransformer, toggleMember } from '@/lib/selection'
import { loadSettings, safeStorage, saveSettings, type Settings } from '@/lib/settings'
import type { Meta, NearEntry, TownId, Transformer } from '@/lib/types'
import { dropUnknown, parseView, serializeView, type ViewState } from '@/lib/url-state'

/** Details card over the map's right edge: 384 px wide, 12 px from the edge. */

const MapView = dynamic(() => import('@/components/map-view'), { ssr: false, loading: () => <div className="h-full w-full bg-muted" /> })

/** shadcn inset sidebar shell (as in the sidebar-inset example): sidebar on the left, the map in the inset. */
/** Phone details sheet: half height, or full. */
// Phones: the details sheet opens at a third of the screen and can be pulled up to full height, or down to a peek that
// keeps its header (title, copy link, ✕) and handle on screen. The map is then clear while the selection is kept.
const PEEK = '76px'
const THIRD = 1 / 3
const SNAP_POINTS = [PEEK, THIRD, 1]

export function Dashboard() {
  return (
    <SidebarProvider className="h-svh" style={{ '--sidebar-width': 'calc(4rem + 340px)', '--sidebar-width-icon': '4rem' } as CSSProperties}>
      <DashboardBody />
    </SidebarProvider>
  )
}

function DashboardBody() {
  const pathname = usePathname()
  const params = useSearchParams()
  // Not useSidebar(): its value changes on every collapse/expand, which would re-render the whole list and map at the
  // start of the slide. Only the phone sheet matters here, and SidebarBridge hands it over in a ref.
  const isMobile = useIsMobile()
  const openMobileRef = useRef<(open: boolean) => void>(() => {})
  const setOpenMobile = (open: boolean) => openMobileRef.current(open)
  // The URL is the source of truth. Updates go through history.replaceState (Next keeps useSearchParams in sync, with no
  // server round-trip), and each one starts from the URL as it is right now, so clicks faster than a re-render still stack.
  // Next syncs useSearchParams in a later render, though, so the view is also kept here and set with the update: the new
  // selection then renders together with the camera request, before the map starts flying, instead of landing mid-flight
  // and stalling it. When Next's sync arrives the query is the same, so nothing re-renders for it.
  const urlKey = serializeView(parseView(new URLSearchParams(params.toString())))
  const [viewKey, setViewKey] = useState(urlKey)
  const [syncedKey, setSyncedKey] = useState(urlKey)
  if (urlKey !== syncedKey) {
    setSyncedKey(urlKey)
    setViewKey(urlKey)
  }
  const view = useMemo(() => parseView(new URLSearchParams(viewKey)), [viewKey])
  const updateView = useCallback((fn: (v: ViewState) => ViewState): ViewState => {
    const next = fn(parseView(new URLSearchParams(window.location.search)))
    const key = serializeView(next)
    window.history.replaceState(null, '', `${pathname}${key}`)
    setViewKey(key)
    return next
  }, [pathname])

  const [transformers, setTransformers] = useState<Transformer[] | null>(null)
  const [meta, setMeta] = useState<Meta | null>(null)
  // Dashboard renders client-only (useSearchParams bails out of prerendering), so reading storage here can't mismatch.
  const [settings, setSettingsState] = useState<Settings>(() => loadSettings(safeStorage()))
  const [nearById, setNearById] = useState<Record<string, NearEntry[]>>({})
  const [retry, setRetry] = useState(0)
  const [failedNear, setFailedNear] = useState<string[]>([])
  const retryNear = () => {
    setFailedNear([])
    setRetry((n) => n + 1)
  }
  // Details pop up on the right when something is selected; the panel button hides / re-shows them.
  const [panelOpen, setPanelOpen] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(() => view.selected.length > 0) // phones: details in a bottom sheet
  const [snap, setSnap] = useState<number | string | null>(THIRD)
  // The desktop pane's real height (it grows on narrow maps), so camera framing and the credits clear it.
  const paneRef = useRef<HTMLElement>(null)
  const [paneHeight, setPaneHeight] = useState(320)
  useEffect(() => {
    const el = paneRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setPaneHeight(el.offsetHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [isMobile])
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('reach')
  const [notes, setNotes] = useState(EMPTY_NOTES)
  const notify = useCallback((n: NoteInput) => setNotes((s) => addNote(s, n, Date.now())), [])
  const [camera, setCamera] = useState<Camera>({ kind: 'country', seq: 0 })
  const cameraTo = (c: CameraTarget) => setCamera((prev) => ({ ...c, seq: prev.seq + 1 }))

  // The Reduce motion setting: globals.css switches every animation off under this attribute.
  useEffect(() => {
    if (settings.reduceMotion) document.documentElement.dataset.motion = 'reduce'
    else delete document.documentElement.dataset.motion
  }, [settings.reduceMotion])

  const setSettings = (s: Settings) => {
    setSettingsState(s)
    saveSettings(s, safeStorage())
  }

  // On load: fetch data, then drop unknown ids from a shared link and point the camera at what the link names.
  // `view` here is the URL as first opened, which is exactly what should be checked.
  useEffect(() => {
    loadTransformers()
      .then((ts) => {
        setTransformers(ts)
        const { view: clean, dropped } = dropUnknown(view, new Set(ts.map((t) => t.id)))
        if (dropped) {
          const message = `${dropped} transformer${dropped === 1 ? '' : 's'} in this link ${dropped === 1 ? "wasn't" : "weren't"} found.`
          toast(message)
          notify({ id: 'link-unknown', severity: 'warning', message })
          updateView(() => clean)
        }
        if (clean.overlap && clean.selected.length) cameraTo({ kind: 'selection', ids: clean.selected })
        else if (clean.selected.length === 1) cameraTo({ kind: 'transformer', id: clean.selected[0] })
        else if (clean.town) cameraTo({ kind: 'town', town: clean.town })
      })
      .catch(() => {
        const message = "Couldn't load transformer data. Reload the page to try again."
        toast.error(message)
        notify({ id: 'data-transformers', severity: 'error', message })
      })
    loadMeta()
      .then((m) => {
        setMeta(m)
        // Warnings the data step wrote (skipped placemarks, transformers far from any town).
        ;(m.warnings ?? []).forEach((message, i) => notify({ id: `data-step-${i}`, severity: 'warning', message: `Data step: ${message}` }))
      })
      .catch(() => {
        setMeta(null)
        notify({ id: 'data-meta', severity: 'warning', message: "Couldn't load data details (build date, sources)." })
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fetch near-files for the selection; results are keyed by id so a slow response can't paint the wrong transformer.
  const selectedKey = view.selected.join(',')
  useEffect(() => {
    // Wait for the transformer list so ids from a stale link are dropped before anything is fetched.
    if (!transformers) return
    for (const id of view.selected) {
      if (nearById[id] || !transformers.some((t) => t.id === id)) continue
      loadNear(id)
        .then((list) => setNearById((m) => ({ ...m, [id]: list })))
        .catch(() => {
          setFailedNear((f) => (f.includes(id) ? f : [...f, id]))
          const name = transformers.find((t) => t.id === id)?.name ?? id
          toast.error("Couldn't load building highlights", { id: `near-${id}`, duration: Infinity, action: { label: 'Retry', onClick: retryNear } })
          notify({ id: `near-${id}`, severity: 'error', message: `Couldn't load building highlights for ${name}.`, retry: true })
        })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey, retry, transformers])

  const list = useMemo(() => (transformers ? sortTransformers(filterTransformers(transformers, view.town, query), sort) : []), [transformers, view.town, query, sort])
  const byId = useMemo(() => new Map((transformers ?? []).map((t) => [t.id, t])), [transformers])
  const selectedTs = view.selected.map((id) => byId.get(id)).filter((t): t is Transformer => !!t)
  const lists = useMemo(() => view.selected.map((id) => nearById[id]), [view.selected, nearById])
  const ready = lists.length > 0 && lists.every(Boolean)
  const stats = useMemo(() => (view.overlap && lists.length >= 2 && ready ? compareStats(lists as NearEntry[][]) : null), [view.overlap, lists, ready])
  const tint = useMemo<Tint>(() => {
    if (!ready) return { bands: null, shared: [] }
    if (lists.length >= 2) return compareTint(lists as NearEntry[][], view.radius)
    return { bands: singleBands(lists[0]!), shared: [] }
  }, [lists, ready, view.radius])

  const fitSelection = (ids: string[]) => cameraTo(ids.length === 1 ? { kind: 'transformer', id: ids[0] } : { kind: 'selection', ids })
  // Phones layer the sheets: the details sheet stays open behind the list, which goes over it. Checking boxes builds
  // the comparison behind the list; showing one transformer swaps the details and closes the list so it can be read.
  const show = (next: ViewState) => {
    setPanelOpen(true)
    setSheetOpen(true)
    setSnap((s) => (s === PEEK ? THIRD : s)) // a peeking sheet comes back up to show what was picked
    if (!next.overlap) setOpenMobile(false)
    if (next.selected.length) fitSelection(next.selected)
  }
  // A dot on the map: while comparing it adds or removes that transformer.
  const pick = (id: string) => show(updateView((v) => openTransformer(v, id)))
  // A row in the list always shows that transformer (checkboxes build comparisons).
  const showOne = (id: string) => show(updateView((v) => ({ ...v, overlap: false, selected: [id] })))
  const toggle = (id: string) => show(updateView((v) => toggleMember(v, id)))
  const setTown = (town: TownId | null) => {
    updateView((v) => ({ ...v, town, selected: [] }))
    cameraTo(town ? { kind: 'town', town } : { kind: 'country' })
  }
  const home = () => {
    updateView((v) => clearSelection({ ...v, town: null }))
    setQuery('')
    cameraTo({ kind: 'country' })
    setOpenMobile(false)
  }
  const fit = () => {
    if (view.selected.length) fitSelection(view.selected)
    else if ((view.town || query.trim()) && list.length) cameraTo({ kind: 'selection', ids: list.map((t) => t.id) })
    else cameraTo({ kind: 'country' })
  }
  const downloadCsv = () => {
    const url = URL.createObjectURL(new Blob([toCsv(list)], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `transformer-reach-${view.town ?? 'all-cities'}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const compareNearby = (t: Transformer) => {
    const ids = [t.id, ...nearby]
    updateView((v) => ({ ...v, overlap: true, selected: ids }))
    fitSelection(ids)
  }
  // ✕: slide the card out first, then clear the selection, so it never empties mid-animation.
  const closeDetails = () => {
    setPanelOpen(false)
    setSheetOpen(false)
    setSnap(THIRD) // the next selection opens at a third again
    // Leave panelOpen false: the URL change lands a frame after any state set here, so reopening now would briefly
    // re-show the old selection and bounce the card. Every path that selects again (pick, toggle) reopens it.
    setTimeout(() => updateView(clearSelection), 300)
  }

  const single = !view.overlap && selectedTs.length === 1 ? selectedTs[0] : null
  // Every other transformer within 500 m of the one being viewed, for "Compare with nearby".
  const nearby = transformers && single ? nearbyIds(transformers, single) : []
  const hasDetails = selectedTs.length > 0
  const shown = hasDetails && (isMobile ? sheetOpen : panelOpen)

  let details: ReactNode = null
  if (transformers && view.overlap && hasDetails)
    details = (
      <OverlapDetails selected={selectedTs} radius={view.radius} stats={stats}
        failed={view.selected.some((id) => failedNear.includes(id))} onRetry={retryNear}
        onRadius={(radius) => updateView((v) => ({ ...v, radius }))} onRemove={(id) => updateView((v) => toggleMember(v, id))}
        onLocate={(id) => cameraTo({ kind: 'transformer', id })} />
    )
  else if (transformers && single)
    details = (
      <TransformerDetails t={single} nearby={nearby.length}
        onStep={(dir) => pick(stepInList(list.map((t) => t.id), single.id, dir))}
        onCompareNearby={() => compareNearby(single)} />
    )

  // Switching between single and compare fades the card in; stepping between transformers keeps the cards and
  // animates only what's in them (see TransformerDetails).
  const detailsBody = details && (
    <div key={view.overlap ? 'overlap' : 'single'} data-testid="details-body" className="flex min-h-0 flex-1 animate-in fade-in flex-col duration-300">{details}</div>
  )

  const transformerList = transformers ? (
    <TransformerList list={list} town={view.town} query={query} sort={sort} compare={view.overlap} selected={view.selected} settings={settings}
      onQuery={setQuery} onSort={setSort}
      onClear={() => updateView(clearSelection)} onPick={showOne} onToggle={toggle} onCsv={downloadCsv} />
  ) : (
    <p className="p-2 text-sm text-muted-foreground">Loading transformers…</p>
  )

  return (
    <>
      <SidebarBridge setterRef={openMobileRef} />
      {isMobile
        ? <MobileSidebar onHome={home} onSettings={() => setSettingsOpen(true)}>{transformerList}</MobileSidebar>
        : <AppSidebar onHome={home} onSettings={() => setSettingsOpen(true)}>{transformerList}</AppSidebar>}
      {/* Corners nest evenly: the frame's 20 px radius is the 10 px radius of everything floating on the map plus the
          10 px it sits in from the edge. */}
      <SidebarInset className="@container/map min-h-0 overflow-hidden md:peer-data-[variant=inset]:ml-2 md:peer-data-[variant=inset]:rounded-[20px]">
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-[inherit]">
          <MapView transformers={transformers ?? []} visible={list} settings={settings} view={view} tint={tint} camera={camera} loading={!transformers}
            onPick={pick} onToggle={toggle} onTown={setTown} onIssue={notify} onFit={fit}
            leading={<SidebarTrigger className={`${MAP_BUTTON} shadow-sm`} />}
            controls={<NotificationsButton notes={notes} onOpen={() => setNotes(markRead)} onClear={() => setNotes(clearNotes)} onRetry={retryNear} />}
            bottomInset={!isMobile && shown ? paneHeight + 10 : 0} panelHeight={isMobile ? 0 : paneHeight + 10} />
          {!isMobile && (
            // A landscape pane along the bottom of the map, sliding up when a transformer is picked; always mounted so it
            // slides, inert while hidden. 10 px in from the map edges like everything else floating on the map. 320 px
            // tall; on a narrow map (under 660 px, where its contents stack) it grows to 55% of the map's height.
            <aside ref={paneRef} aria-label="Details" inert={!shown}
              className={`@container absolute inset-x-[10px] bottom-[10px] z-20 flex h-[320px] max-h-[calc(100%-20px)] flex-col @max-[41.25rem]/map:h-[55%] overflow-hidden ${PANEL_SURFACE} ${SLIDE} ${shown ? '' : 'translate-y-[calc(100%+10px)]'}`}>
              <DetailsHeader title={view.overlap ? 'Overlap' : 'Transformer'} onClose={closeDetails} />
              {detailsBody}
            </aside>
          )}
        </div>
      </SidebarInset>

      {isMobile && (
        // While something is selected the sheet never goes away on its own: only ✕ (its own handler) closes it and clears
        // the selection. A swipe down past the peek, or Escape, just leaves it peeking. Taps on the map don't dismiss it
        // (they pick transformers), and the list sheet opening over it takes focus, which must not close it either.
        <Drawer open={shown} onOpenChange={(o, d) => {
            if (o || (d.reason !== 'swipe' && d.reason !== 'escape-key')) return
            d.cancel() // stay open (cancelling also stops Base UI resetting the snap point), and drop to the peek
            setSnap(PEEK)
          }}
          // A swipe down past the lowest point asks to dismiss by setting the snap point to null: refuse, and peek.
          onSnapPointChange={(p, d) => {
            if (p === null) {
              d.cancel()
              setSnap(PEEK)
            } else setSnap(p)
          }}
          modal={false} disablePointerDismissal showSwipeHandle snapPoints={SNAP_POINTS} snapPoint={snap}>
          {/* Below full height the bottom of the sheet sits below the screen; the details body pads by that offset so
              its end is reachable. Base UI's variable doesn't inherit, so the sheet copies it to --sheet-offset. */}
          <DrawerContent className="h-[100dvh] [--sheet-offset:var(--drawer-snap-point-offset,0px)]">
            <DrawerTitle className="sr-only">Details</DrawerTitle>
            <DetailsHeader title={view.overlap ? 'Overlap' : 'Transformer'} onClose={closeDetails} />
            {detailsBody}
          </DrawerContent>
        </Drawer>
      )}
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} settings={settings} onChange={setSettings} meta={meta} />
    </>
  )
}

/** The details pane's header, the same on desktop and phones: one 48 px row over a full-width line, the title styled
    like the panel's, and a compact ✕ whose icon sits on the 16 px content edge (with a 44 px tap area for touch). */
function DetailsHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div data-testid="details-header" className="flex h-12 shrink-0 items-center justify-between gap-2 border-b pl-4 pr-2">
      <span data-testid="details-title" className="text-[15px] font-semibold leading-tight tracking-tight">{title}</span>
      <div className="flex items-center gap-1">
        <CopyLinkButton />
        <Button variant="ghost" size="icon" className={HEADER_ICON} aria-label="Close details" onClick={onClose}><X /></Button>
      </div>
    </div>
  )
}

const HEADER_ICON = 'relative size-8 after:absolute after:-inset-1.5'

/** Copies the page's link, which holds the whole view (selection, compare mode, city, radius), so whoever opens it sees
    the same thing. A ✓ and a toast confirm it. */
function CopyLinkButton() {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      toast.success('Link copied', { description: 'Anyone with the link sees this view.' })
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Couldn't copy the link", { description: 'Copy it from the address bar instead.' })
    }
  }
  return (
    <Tooltip>
      <TooltipTrigger render={<Button variant="ghost" size="icon" className={HEADER_ICON} aria-label="Copy link" onClick={copy} />}>
        {copied ? <Check /> : <Link2 />}
      </TooltipTrigger>
      <TooltipContent>Copy link</TooltipContent>
    </Tooltip>
  )
}

/** Passes the phone list sheet's setter out without making the dashboard a consumer of the sidebar context. */
function SidebarBridge({ setterRef }: { setterRef: { current: (open: boolean) => void } }) {
  const { setOpenMobile } = useSidebar()
  useEffect(() => {
    setterRef.current = setOpenMobile
  }, [setOpenMobile, setterRef])
  return null
}
