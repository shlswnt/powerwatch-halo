'use client'

import { ArrowRight, ArrowUpDown, Download, GitCompareArrows, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Toggle } from '@/components/ui/toggle'
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
  onCompare: (on: boolean) => void
  onClear: () => void
  onPick: (id: string) => void
  onToggle: (id: string) => void
  onCsv: () => void
  /** Open the overlap view for the ticked transformers. */
  onOpenCompare: () => void
}

const SORTS: Record<SortKey, string> = { reach: 'Most buildings ≤500 m', near: 'Most buildings ≤100 m', name: 'Name A–Z' }

/** Search, sort menu, compare toggle and the transformer rows with their band segment bars. */
export function TransformerList({ list, town, query, sort, compare, selected, settings, onQuery, onSort, onCompare, onClear, onPick, onToggle, onCsv, onOpenCompare }: Props) {
  const max = Math.max(1, ...list.map(total500))
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <label htmlFor="tx-search" className="sr-only">Search transformers</label>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-[15px] -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input id="tx-search" type="search" placeholder="Search name, town or ID" value={query} onChange={(e) => onQuery(e.target.value)}
            className="h-[38px] w-full rounded-lg border border-input bg-card pl-[34px] pr-3 text-[13.5px] outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </div>
        <Button variant="outline" className="h-[38px] gap-1.5 text-[12.5px]" onClick={onCsv} aria-label="Export counts as CSV">
          <Download className="size-3.5" />CSV
        </Button>
      </div>
      {/* Sort menu, then the count; Compare is a small toggle at the end of the row. The city is picked from the map. */}
      <div className="flex min-h-7 items-center gap-1 text-xs text-muted-foreground">
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="-ml-1.5 size-7 text-muted-foreground" aria-label={`Sort: ${SORTS[sort]}`} />}>
            <ArrowUpDown className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-52">
            <DropdownMenuRadioGroup value={sort} onValueChange={(v) => onSort(v as SortKey)}>
              {(Object.keys(SORTS) as SortKey[]).map((k) => <DropdownMenuRadioItem key={k} value={k} closeOnClick>{SORTS[k]}</DropdownMenuRadioItem>)}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="min-w-0 flex-1 truncate">{list.length.toLocaleString('en-US')} transformer{list.length === 1 ? '' : 's'}{town && ` in ${townById(town).name}`}</span>
        <Toggle variant="outline" size="sm" aria-label="Compare mode" pressed={compare} onPressedChange={onCompare}
          className="h-7 gap-1 px-2 text-xs aria-pressed:border-foreground/20 aria-pressed:text-foreground">
          <GitCompareArrows className="size-3.5" />Compare
        </Toggle>
      </div>
      {selected.length > 0 && (
        <div className="-mt-1 flex items-center justify-between gap-2 text-xs">
          <button type="button" onClick={onClear} className="h-[26px] rounded-md px-2 -ml-2 text-foreground/80 hover:bg-accent">Clear selection ({selected.length})</button>
          {compare && selected.length >= 2 && (
            <Button size="sm" className="h-[26px] gap-1 px-2 text-xs" onClick={onOpenCompare} aria-label={`Compare ${selected.length}`}>
              Compare {selected.length}<ArrowRight className="size-3" aria-hidden />
            </Button>
          )}
        </div>
      )}
      <ul aria-label="Transformer list" className="-mx-2">
        {list.length === 0 && <li className="px-3 py-6 text-center text-[13px] text-muted-foreground">{query.trim() ? 'No transformers match this search.' : 'Not yet surveyed'}</li>}
        {list.map((t) => {
          const active = selected.includes(t.id)
          return (
            <li key={t.id} className={cn('flex items-start gap-2.5 rounded-[10px] px-2 py-2.5 hover:bg-foreground/[.04]', active && 'bg-foreground/[.08] hover:bg-foreground/[.08]')}>
              <Checkbox checked={compare && active} onCheckedChange={() => onToggle(t.id)} aria-label={`Compare ${t.name}`} className="mt-0.5" />
              <button type="button" aria-current={active ? 'true' : undefined} onClick={() => onPick(t.id)} className="flex min-w-0 flex-1 flex-col gap-1.5 text-left">
                <span className="flex w-full items-baseline justify-between gap-2.5">
                  <span className="truncate text-[13.5px] font-medium">{t.name}</span>
                  <span className="shrink-0 font-mono text-[13px]">{formatCount(cumulative(t.rings.all)[4], cumulative(t.rings.hi)[4], settings.countMode)}</span>
                </span>
                <span className="flex w-full justify-between gap-2.5 text-xs text-muted-foreground">
                  <span className="truncate">{townById(t.town).name}</span><span className="shrink-0">≤500 m</span>
                </span>
                <span data-testid="segment-bar" aria-hidden className="flex h-1 w-full overflow-hidden rounded-sm bg-foreground/[.06]">
                  {segments(t, max).map((w, i) => <span key={i} style={{ width: `${w}%`, background: BAND_COLORS[i] }} />)}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
