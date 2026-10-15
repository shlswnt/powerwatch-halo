'use client'

import { ArrowDownAZ, ArrowDownWideNarrow, ArrowUpDown, Download, Search, type LucideIcon } from 'lucide-react'
import { memo, useCallback, useLayoutEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { cumulative, formatCount } from '@/lib/counts'
import { segments, total500, type SortKey } from '@/lib/list'
import { BAND_COLORS } from '@/lib/map-style'
import type { Settings } from '@/lib/settings'
import { townById } from '@/lib/towns'
import type { TownId, Transformer } from '@/lib/types'
import { cn } from '@/lib/utils'

interface Props {
  list: Transformer[]
  town: TownId | null
  query: string
  sort: SortKey
  compare: boolean
  selected: string[]
  settings: Settings
  onQuery: (q: string) => void
  onSort: (s: SortKey) => void
  onClear: () => void
  onPick: (id: string) => void
  onToggle: (id: string) => void
  onCsv: () => void
}

const SORTS: Record<SortKey, string> = { reach: 'Most buildings ≤500 m', near: 'Most buildings ≤100 m', name: 'Name A–Z' }
// Both building sorts are the same kind of sort (most first) over different ranges, so they share an icon.
const SORT_ICONS: Record<SortKey, LucideIcon> = { reach: ArrowDownWideNarrow, near: ArrowDownWideNarrow, name: ArrowDownAZ }

/** Search, sort menu, the compare bar (while boxes are ticked) and the transformer rows with their band segment bars. */
export function TransformerList({ list, town, query, sort, compare, selected, settings, onQuery, onSort, onClear, onPick, onToggle, onCsv }: Props) {
  const max = Math.max(1, ...list.map(total500))
  // Stable handlers (calling the latest props), so a selection change re-renders only the rows it touches, not all of
  // them: re-rendering every row stalled the map's flight and the details animations.
  const latest = useRef({ onPick, onToggle })
  useLayoutEffect(() => { latest.current = { onPick, onToggle } })
  const pick = useCallback((id: string) => latest.current.onPick(id), [])
  const toggleRow = useCallback((id: string) => latest.current.onToggle(id), [])
  // The bar shows the tick count; it keeps the last one while it slides closed, rather than flashing "0 selected".
  const [count, setCount] = useState(selected.length)
  if (compare && count !== selected.length) setCount(selected.length)
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <label htmlFor="tx-search" className="sr-only">Search transformers</label>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-[15px] -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input id="tx-search" type="search" placeholder="Search name, town or ID" value={query} onChange={(e) => onQuery(e.target.value)}
            className="h-11 w-full rounded-lg border border-input bg-card pl-[34px] pr-3 text-[13.5px] outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </div>
        <Button variant="outline" size="icon" className="size-11" onClick={onCsv} aria-label="Export counts as CSV" title="Export counts as CSV">
          <Download className="size-4" />
        </Button>
      </div>
      {/* The count on the left (on the search box's edge), the sort menu at the right end: its hover box ends on the
          same edge as the CSV button. The city is picked from the map. */}
      <div className="flex min-h-7 items-center gap-2 text-xs text-muted-foreground">
        <span className="min-w-0 flex-1 truncate">{list.length.toLocaleString('en-US')} transformer{list.length === 1 ? '' : 's'}{town && ` in ${townById(town).name}`}</span>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="size-7 shrink-0 text-muted-foreground" aria-label={`Sort: ${SORTS[sort]}`} />}>
            <ArrowUpDown className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60 p-1.5">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="px-2 pb-1 pt-1.5">Sort by</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={sort} onValueChange={(v) => onSort(v as SortKey)}>
                {(Object.keys(SORTS) as SortKey[]).map((k) => {
                  const Icon = SORT_ICONS[k]
                  return (
                    <DropdownMenuRadioItem key={k} value={k} closeOnClick className="gap-2.5 py-2 pl-2 [&_svg]:text-muted-foreground">
                      <Icon />{SORTS[k]}
                    </DropdownMenuRadioItem>
                  )
                })}
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {/* Ticking boxes is how you compare: while any are ticked, this bar says how many and offers Clear. */}
      {/* Always mounted so it can slide open and closed with CSS (rows 0fr ↔ 1fr, plus a fade). The margin goes from
          -12 px (cancelling the column gap while closed) to the bar's own -4 px. While closing it keeps its last count. */}
      <div data-testid="selection-bar" inert={!compare} aria-hidden={!compare}
        className={cn('grid transition-[grid-template-rows,opacity,margin] duration-200 ease-out motion-reduce:transition-none',
          compare ? '-mt-1 grid-rows-[1fr] opacity-100' : '-mt-3 grid-rows-[0fr] opacity-0')}>
        <div className="min-h-0 overflow-hidden">
          <div className="flex h-9 items-center gap-2 rounded-lg bg-foreground/[.06] pl-3 pr-1 text-xs">
            {/* The count always shows in full; only the hint gives way on narrow screens. */}
            <span className="flex min-w-0 flex-1 items-baseline gap-1">
              <span className="shrink-0 whitespace-nowrap font-medium">{count} selected</span>
              {count < 2 && <span className="truncate text-muted-foreground">· check another to compare</span>}
            </span>
            <button type="button" onClick={onClear} aria-label="Clear selection" className="h-7 rounded-md px-2 text-foreground/80 hover:bg-accent">Clear</button>
          </div>
        </div>
      </div>
      {/* shadcn ScrollArea, edge to edge under the divider: its scrollbar overlays the panel's 16 px padding, so the rows
          keep the same edges as the search box and the bar above, whether or not the list scrolls. */}
      <ScrollArea className="-mx-4 min-h-0 flex-1 border-t border-sidebar-border [&>[data-slot=scroll-area-viewport]]:overscroll-contain">
        <ul aria-label="Transformer list" className="px-4 pt-2 pb-4">
          {list.length === 0 && <li className="animate-in fade-in px-3 py-6 text-center text-[13px] text-muted-foreground">{query.trim() ? 'No transformers match this search.' : 'Not yet surveyed'}</li>}
          {list.map((t, i) => {
            const active = selected.includes(t.id)
            // Selected neighbours join into one block: square off the corners where they meet.
            const joinUp = active && i > 0 && selected.includes(list[i - 1].id)
            const joinDown = active && i < list.length - 1 && selected.includes(list[i + 1].id)
            return <Row key={t.id} t={t} active={active} checked={compare && active} joinUp={joinUp} joinDown={joinDown} max={max} mode={settings.countMode} onPick={pick} onToggle={toggleRow} />
          })}
        </ul>
      </ScrollArea>
    </div>
  )
}

interface RowProps {
  t: Transformer
  active: boolean
  checked: boolean
  joinUp: boolean
  joinDown: boolean
  max: number
  mode: Settings['countMode']
  onPick: (id: string) => void
  onToggle: (id: string) => void
}

const Row = memo(function Row({ t, active, checked, joinUp, joinDown, max, mode, onPick, onToggle }: RowProps) {
  const count = formatCount(cumulative(t.rings.all)[4], cumulative(t.rings.hi)[4], mode)
  const label = `${count} ${mode === 'hi' ? 'high-confidence ' : ''}buildings within 500 m`
  return (
    <li className={cn('flex items-start gap-3 rounded-lg px-3 py-2 transition-[background-color,border-radius] duration-150 hover:bg-foreground/[.04]', active && 'bg-foreground/[.08] hover:bg-foreground/[.08]',
      joinUp && 'rounded-t-none', joinDown && 'rounded-b-none')}>
      <Checkbox checked={checked} onCheckedChange={() => onToggle(t.id)} aria-label={`Compare ${t.name}`} className="mt-0.5" />
      <button type="button" aria-current={active ? 'true' : undefined} onClick={(e) => (e.shiftKey || e.metaKey || e.ctrlKey ? onToggle(t.id) : onPick(t.id))}
        // Shift/⌘/Ctrl-click adds the row to a comparison, as on the map; stop shift-click selecting text.
        onMouseDown={(e) => { if (e.shiftKey) e.preventDefault() }}
        className="flex min-w-0 flex-1 flex-col text-left">
        {/* Name and building count, the town under it, then the band bar. The count's meaning is said once, in its
            tooltip and label, rather than on every row. */}
        <span className="flex w-full items-baseline justify-between gap-3">
          <span data-testid="row-name" className="truncate text-sm font-medium">{t.name}</span>
          <span data-testid="row-count" className="shrink-0 text-sm font-medium tabular-nums" title={label} aria-label={label}>{count}</span>
        </span>
        <span data-testid="row-town" className="truncate text-xs text-muted-foreground">{townById(t.town).name}</span>
        <span data-testid="segment-bar" aria-hidden className="mt-2 flex h-[3px] w-full overflow-hidden rounded-full bg-foreground/[.06]">
          {segments(t, max).map((w, i) => <span key={i} style={{ width: `${w}%`, background: BAND_COLORS[i] }} />)}
        </span>
      </button>
    </li>
  )
})
