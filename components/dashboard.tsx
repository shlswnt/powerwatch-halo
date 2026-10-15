'use client'

import dynamic from 'next/dynamic'
import { usePathname, useSearchParams } from 'next/navigation'
import { X } from 'lucide-react'
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
import { SidebarInset, SidebarProvider, SidebarTrigger, useSidebar } from '@/components/ui/sidebar'
import { useIsMobile } from '@/hooks/use-mobile'
import { compareStats, compareTint } from '@/lib/compare'
import { loadMeta, loadNear, loadTransformers } from '@/lib/data'
import { filterTransformers, nearbyIds, sortTransformers, stepInList, toCsv, type SortKey } from '@/lib/list'
import { singleBands } from '@/lib/map-style'
import { EMPTY_NOTES, addNote, clearNotes, markRead, type NoteInput } from '@/lib/notifications'
import { clearSelection, openTransformer, setOverlap, toggleMember } from '@/lib/selection'
import { loadSettings, safeStorage, saveSettings, type Settings } from '@/lib/settings'
import type { Meta, NearEntry, TownId, Transformer } from '@/lib/types'
import { dropUnknown, parseView, serializeView, type ViewState } from '@/lib/url-state'

/** Details card over the map's right edge: 384 px wide, 12 px from the edge. */
const DETAILS_INSET = 396

const MapView = dynamic(() => import('@/components/map-view'), { ssr: false, loading: () => <div className="h-full w-full bg-muted" /> })

/** shadcn inset sidebar shell (as in the sidebar-inset example): sidebar on the left, the map in the inset. */
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
  // start of the slide. Only the phone-sheet setter is needed, and SidebarBridge hands it over once.
  const isMobile = useIsMobile()
  const openMobileRef = useRef<(open: boolean) => void>(() => {})
  const setOpenMobile = (open: boolean) => openMobileRef.current(open)
  const view = useMemo(() => parseView(new URLSearchParams(params.toString())), [params])
  // The URL is the source of truth. Updates go through history.replaceState (Next keeps useSearchParams in sync, with no
  // server round-trip), and each one starts from the URL as it is right now, so clicks faster than a re-render still stack.
  const updateView = useCallback((fn: (v: ViewState) => ViewState): ViewState => {
    const next = fn(parseView(new URLSearchParams(window.location.search)))
    window.history.replaceState(null, '', `${pathname}${serializeView(next)}`)
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
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('reach')
  const [notes, setNotes] = useState(EMPTY_NOTES)
  const notify = useCallback((n: NoteInput) => setNotes((s) => addNote(s, n, Date.now())), [])
  const [camera, setCamera] = useState<Camera>({ kind: 'country', seq: 0 })
  const cameraTo = (c: CameraTarget) => setCamera((prev) => ({ ...c, seq: prev.seq + 1 }))

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
  const pick = (id: string) => {
    const next = updateView((v) => openTransformer(v, id))
    setPanelOpen(true)
    setSheetOpen(true)
    // Phones: get the sidebar sheet out of the way so the details show (unless ticking several to compare).
    if (!next.overlap) setOpenMobile(false)
    if (next.selected.length) fitSelection(next.selected)
  }
  const toggle = (id: string) => {
    const next = updateView((v) => toggleMember(v, id))
    setPanelOpen(true)
    setSheetOpen(true)
    if (next.selected.length) fitSelection(next.selected)
  }
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
    const ids = [t.id, ...nearbyIds(transformers ?? [], t)]
    updateView((v) => ({ ...v, overlap: true, selected: ids }))
    fitSelection(ids)
  }
  // ✕: slide the card out first, then clear the selection, so it never empties mid-animation.
  const closeDetails = () => {
    setPanelOpen(false)
    setSheetOpen(false)
    // Leave panelOpen false: the URL change lands a frame after any state set here, so reopening now would briefly
    // re-show the old selection and bounce the card. Every path that selects again (pick, toggle) reopens it.
    setTimeout(() => updateView((v) => ({ ...v, selected: [] })), 300)
  }

  const single = !view.overlap && selectedTs.length === 1 ? selectedTs[0] : null
  const hasDetails = selectedTs.length > 0
  const shown = hasDetails && (isMobile ? sheetOpen : panelOpen)

  let details: ReactNode = null
  if (transformers && view.overlap && hasDetails)
    details = (
      <OverlapDetails selected={selectedTs} radius={view.radius} stats={stats}
        failed={view.selected.some((id) => failedNear.includes(id))} onRetry={retryNear}
        onRadius={(radius) => updateView((v) => ({ ...v, radius }))} onRemove={(id) => updateView((v) => toggleMember(v, id))} />
    )
  else if (transformers && single)
    details = (
      <TransformerDetails t={single} settings={settings}
        onStep={(dir) => pick(stepInList(list.map((t) => t.id), single.id, dir))}
        onCompareNearby={() => compareNearby(single)} />
    )

  const transformerList = transformers ? (
    <TransformerList list={list} town={view.town} query={query} sort={sort} compare={view.overlap} selected={view.selected} settings={settings}
      onQuery={setQuery} onSort={setSort} onCompare={(on) => updateView((v) => setOverlap(v, on))}
      onClear={() => updateView((v) => ({ ...v, selected: [] }))} onPick={pick} onToggle={toggle} onCsv={downloadCsv}
      onOpenCompare={() => {
        setPanelOpen(true)
        setSheetOpen(true)
        setOpenMobile(false)
      }} />
  ) : (
    <p className="p-2 text-sm text-muted-foreground">Loading transformers…</p>
  )

  return (
    <>
      <SidebarBridge setterRef={openMobileRef} />
      {isMobile
        ? <MobileSidebar onHome={home} onSettings={() => setSettingsOpen(true)}>{transformerList}</MobileSidebar>
        : <AppSidebar onHome={home} onSettings={() => setSettingsOpen(true)}>{transformerList}</AppSidebar>}
      <SidebarInset className="min-h-0 overflow-hidden md:peer-data-[variant=inset]:ml-2">
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-[inherit]">
          <MapView transformers={transformers ?? []} visible={list} settings={settings} view={view} tint={tint} camera={camera} loading={!transformers}
            onPick={pick} onToggle={toggle} onTown={setTown} onIssue={notify} onFit={fit}
            leading={<SidebarTrigger className={`${MAP_BUTTON} shadow-sm`} />}
            controls={<NotificationsButton notes={notes} onOpen={() => setNotes(markRead)} onClear={() => setNotes(clearNotes)} onRetry={retryNear} />}
            rightInset={!isMobile && shown ? DETAILS_INSET : 0} panelWidth={isMobile ? 0 : DETAILS_INSET} />
          {!isMobile && (
            // Pops up over the map when a transformer is picked; always mounted so it slides, inert while hidden.
            <aside aria-label="Details" inert={!shown}
              className={`absolute inset-y-3 right-3 z-20 flex w-[384px] max-w-[calc(100%-24px)] flex-col overflow-hidden ${PANEL_SURFACE} ${SLIDE} ${shown ? '' : 'translate-x-[calc(100%+12px)]'}`}>
              <div className="flex shrink-0 items-center justify-between border-b py-1.5 pl-4 pr-1.5">
                <span className="text-[11.5px] uppercase tracking-[0.06em] text-muted-foreground">{view.overlap ? 'Overlap' : 'Transformer'}</span>
                <Button variant="ghost" size="icon" className="size-9" aria-label="Close details" onClick={closeDetails}><X /></Button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">{details}</div>
            </aside>
          )}
        </div>
      </SidebarInset>

      {isMobile && (
        <Drawer open={shown} onOpenChange={(o) => !o && setSheetOpen(false)} modal={false} snapPoints={[0.5, 1]}>
          <DrawerContent className="h-[100dvh]">
            <DrawerTitle className="sr-only">Details</DrawerTitle>
            <div className="flex shrink-0 items-center justify-between px-4 pb-1">
              <span className="text-[11.5px] uppercase tracking-[0.06em] text-muted-foreground">{view.overlap ? 'Overlap' : 'Transformer'}</span>
              <Button variant="ghost" size="icon" className="size-11" aria-label="Close details" onClick={closeDetails}><X /></Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto pb-6">{details}</div>
          </DrawerContent>
        </Drawer>
      )}
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} settings={settings} onChange={setSettings} meta={meta} />
    </>
  )
}

/** Passes the sidebar's phone-sheet setter out without making the dashboard a consumer of the sidebar context. */
function SidebarBridge({ setterRef }: { setterRef: { current: (open: boolean) => void } }) {
  const { setOpenMobile } = useSidebar()
  useEffect(() => {
    setterRef.current = setOpenMobile
  }, [setOpenMobile, setterRef])
  return null
}
