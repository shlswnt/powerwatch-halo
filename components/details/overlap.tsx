import { GitCompareArrows, X } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { CompareStats } from '@/lib/compare'
import { BAND_COLORS } from '@/lib/map-style'
import { BANDS, type Radius, type Transformer } from '@/lib/types'
import { cn } from '@/lib/utils'
import { DetailsLayout, Stat, fmt } from './common'

interface Props {
  selected: Transformer[]
  radius: Radius
  stats: CompareStats | null
  failed: boolean
  onRetry: () => void
  onRadius: (r: Radius) => void
  onRemove: (id: string) => void
  /** Fly the map to this transformer (the comparison stays as it is). */
  onLocate: (id: string) => void
}

const grid = 'grid grid-cols-[minmax(0,1fr)_68px_68px] items-center gap-2 px-3.5 py-2'
// The transformer table is its own container (/tx): where it's wide the coordinates sit on one line; where it's narrow
// (phones, the wide pane's left column) latitude goes over longitude and the number columns slim down, so the name
// keeps its room. Long names wrap rather than being cut off.
const txGrid = 'grid grid-cols-[minmax(0,1fr)_4.25rem_3.5rem_4rem] items-center gap-1.5 px-3 @min-[24rem]/tx:grid-cols-[minmax(0,1fr)_6.5rem_4rem_4.25rem] @min-[24rem]/tx:gap-2 @min-[24rem]/tx:px-3.5'

/** How to add a transformer from the map on this device: ⌘-click on a Mac, Ctrl-click elsewhere, a tap on touch screens
    (Shift-click works everywhere too). Read in the browser; the static page starts with the Windows/Linux wording. */
function pickOnMapHint(): string {
  if (window.matchMedia('(pointer: coarse)').matches) return 'tap'
  return /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘-click' : 'Ctrl-click'
}
const noSubscribe = () => () => {}

export function OverlapDetails({ selected, radius, stats, failed, onRetry, onRadius, onRemove, onLocate }: Props) {
  const pickOnMap = useSyncExternalStore(noSubscribe, pickOnMapHint, () => 'Ctrl-click')
  const ri = BANDS.indexOf(radius)
  const n = selected.length
  return (
    // Pinned: what is being compared and at which radius. Scrolling: the numbers.
    <DetailsLayout label="Overlap" summary={<>
      {/* The card's header already says "Overlap", so no second label here; same size as a transformer's name. */}
      <h2 className="text-lg font-semibold tracking-tight">Comparing {n} transformer{n === 1 ? '' : 's'}</h2>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">Overlap radius</span>
        {/* One highlight behind the buttons slides to the chosen radius: each step is its own width plus the 2 px gap. */}
        <div role="group" aria-label="Overlap radius" className="relative grid grid-cols-5 gap-0.5 rounded-lg border bg-card p-[3px]">
          <span data-testid="radius-indicator" aria-hidden className="absolute inset-y-[3px] left-[3px] w-[calc((100%-14px)/5)] rounded-md bg-foreground transition-transform duration-300 ease-out motion-reduce:transition-none"
            style={{ transform: `translateX(calc(${ri} * (100% + 2px)))` }} />
          {BANDS.map((r) => (
            <button key={r} type="button" aria-pressed={r === radius} onClick={() => onRadius(r)}
              className={cn('relative h-8 rounded-md font-mono text-xs transition-colors duration-300', r === radius ? 'font-semibold text-background' : 'text-foreground/80 hover:bg-foreground/5')}>
              {r} m
            </button>
          ))}
        </div>
      </div>
      {/* With many transformers only the chips scroll: the heading and radius picker stay in view. They fill the rest of
          the summary column in the wide pane; in the phone sheet about two rows show. */}
      <div data-testid="overlap-chips" className="flex min-h-0 flex-col @min-[40rem]:flex-1">
        <ScrollArea className="@min-[40rem]:min-h-0 @min-[40rem]:flex-1 [&>[data-slot=scroll-area-viewport]]:max-h-[4.25rem] @min-[40rem]:[&>[data-slot=scroll-area-viewport]]:max-h-none">
          <div className="flex flex-wrap gap-1.5">
            {selected.map((t) => (
              // shadcn's removable badge: hovering the chip tints the whole pill; the × keeps its own circle on top.
              <span key={t.id} className="inline-flex h-7 max-w-full items-center gap-0.5 rounded-full bg-secondary pr-1 text-[12.5px] transition-colors hover:bg-secondary/80">
                {/* The name shows that transformer on the map; the × removes it. */}
                <button type="button" aria-label={`Show ${t.name} on the map`} title="Show on the map" onClick={() => onLocate(t.id)}
                  className="h-full min-w-0 truncate rounded-full pl-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring/50">{t.name}</button>
                <button type="button" aria-label={`Remove ${t.name}`} onClick={() => onRemove(t.id)} className="flex size-[22px] items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/10"><X className="size-3" /></button>
              </span>
            ))}
          </div>
        </ScrollArea>
      </div>
    </>} fill={n < 2} bodyClassName="@min-[58rem]:h-full @min-[58rem]:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] @min-[58rem]:grid-rows-[minmax(0,1fr)] @min-[58rem]:items-stretch">
      {n < 2 ? (
        // shadcn's empty-state pattern, centred in the space beside the summary.
        <div data-testid="overlap-empty" className="flex animate-in flex-col items-center justify-center gap-2 px-6 py-8 text-center fade-in duration-300 @min-[40rem]:h-full @min-[58rem]:col-span-full">
          <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground"><GitCompareArrows className="size-5" /></span>
          <p className="text-sm font-medium">Add one more to compare</p>
          <p className="max-w-xs text-xs text-muted-foreground">Check another transformer in the list,<br />or {pickOnMap} one on the map.</p>
        </div>
      ) : failed ? (
        <div className="animate-in fade-in duration-300 @min-[58rem]:self-start flex items-center justify-between gap-2 rounded-lg border bg-card p-3.5">
          <p className="text-[13px]">Couldn&apos;t load buildings</p>
          <Button variant="secondary" className="h-11" onClick={onRetry}>Retry</Button>
        </div>
      ) : !stats ? (
        <p className="animate-in fade-in duration-300 @min-[58rem]:self-start rounded-lg bg-card p-3.5 text-[13px] text-muted-foreground">Loading building footprints — overlap counts appear in a moment.</p>
      ) : (
        // The results fade in once the footprints have loaded. In the wide pane the wrapper dissolves (contents) into
        // two columns that exactly fill it: the stats with the transformer table under them (which scrolls its own rows
        // when many are compared), and the radius table beside, its rows spread to the full height.
        <div className="animate-in fade-in duration-300 flex flex-col gap-3 @min-[58rem]:contents">
          <div className="flex flex-col gap-3 @min-[58rem]:min-h-0">
            <div className="grid grid-cols-2 gap-2">
              <Stat inverted label={`Shared within ${radius} m`} value={fmt(stats.shared[ri])} />
              <Stat label="Unique buildings covered" value={fmt(stats.covered[ri])} />
            </div>
            <div className="@container/tx flex flex-col overflow-hidden rounded-lg border @min-[58rem]:min-h-0 @min-[58rem]:flex-1" role="table" aria-label="Overlap by transformer">
              <div role="row" className={cn(txGrid, 'shrink-0 bg-card py-1.5 text-[11.5px] leading-tight text-muted-foreground')}>
                <span role="columnheader">Transformer</span>
                <span role="columnheader">Location</span>
                <span role="columnheader" className="text-right" title={`Buildings within ${radius} m of this transformer`}>In range</span>
                <span role="columnheader" className="text-right" title={`Buildings within ${radius} m of this transformer and of no other selected one`}>Not shared</span>
              </div>
              {/* Plain min-h-0/flex-1 (not @min-[58rem]): inside the table, unnamed container queries would measure the table. */}
              <ScrollArea className="min-h-0 flex-1">
                {selected.map((t, j) => (
                  <div key={t.id} role="row" className={cn(txGrid, 'border-t border-foreground/[.06] py-2 text-[13px]')}>
                    <span role="cell" className="leading-tight break-words">{t.name}</span>
                    <span role="cell" className="font-mono text-[11px] leading-tight text-muted-foreground">
                      <span className="block @min-[24rem]/tx:inline">{t.lat.toFixed(5)},</span>{' '}
                      <span className="block @min-[24rem]/tx:inline">{t.lon.toFixed(5)}</span>
                    </span>
                    <span role="cell" className="text-right font-mono">{fmt(stats.inRange[ri][j])}</span>
                    <span role="cell" className="text-right font-mono text-foreground/80">{fmt(stats.only[ri][j])}</span>
                  </div>
                ))}
              </ScrollArea>
            </div>
          </div>
          <div className="flex flex-col overflow-hidden rounded-lg border" role="table" aria-label="Overlap by radius">
            <div role="row" className={`${grid} bg-card text-[11.5px] text-muted-foreground`}>
              <span role="columnheader">Within</span><span role="columnheader" className="text-right">Covered</span><span role="columnheader" className="text-right">Shared</span>
            </div>
            {BANDS.map((r, i) => (
              <div key={r} role="row" className={cn(grid, 'items-center border-t border-foreground/[.06] text-[13px] @min-[58rem]:flex-1', r === radius && 'bg-foreground/[.06]')}>
                <span role="cell" className="flex items-center gap-2"><span className="size-[9px] rounded-full" style={{ background: BAND_COLORS[i] }} /><span className="font-mono">≤{r} m</span></span>
                <span role="cell" className="text-right font-mono">{fmt(stats.covered[i])}</span>
                <span role="cell" className="text-right font-mono">{fmt(stats.shared[i])}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </DetailsLayout>
  )
}
