import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CompareStats } from '@/lib/compare'
import { BAND_COLORS } from '@/lib/map-style'
import { ringsIntersect } from '@/lib/overlap'
import { BANDS, type Radius, type Transformer } from '@/lib/types'
import { cn } from '@/lib/utils'
import { SectionLabel, Stat, fmt } from './common'

interface Props {
  selected: Transformer[]
  radius: Radius
  stats: CompareStats | null
  failed: boolean
  onRetry: () => void
  onRadius: (r: Radius) => void
  onRemove: (id: string) => void
}

const grid = 'grid grid-cols-[minmax(0,1fr)_76px_76px] items-center gap-2 px-3.5 py-2'

export function OverlapDetails({ selected, radius, stats, failed, onRetry, onRadius, onRemove }: Props) {
  const ri = BANDS.indexOf(radius)
  const n = selected.length
  const sumIn = stats ? stats.inRange[ri].reduce((a, b) => a + b, 0) : 0
  return (
    <section aria-label="Overlap" className="flex flex-col gap-4 px-4 pb-6 pt-5">
      <div className="flex flex-col gap-0.5">
        <SectionLabel>Overlap</SectionLabel>
        <h2 className="text-[22px] font-semibold tracking-tight">Comparing {n} transformer{n === 1 ? '' : 's'}</h2>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {selected.map((t) => (
          <span key={t.id} className="inline-flex h-7 max-w-full items-center gap-1 rounded-full bg-secondary pl-2.5 pr-1 text-[12.5px]">
            <span className="truncate">{t.name}</span>
            <button type="button" aria-label={`Remove ${t.name}`} onClick={() => onRemove(t.id)} className="flex size-[22px] items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/10"><X className="size-3" /></button>
          </span>
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">Overlap radius</span>
        <div role="group" aria-label="Overlap radius" className="grid grid-cols-5 gap-0.5 rounded-[10px] border bg-card p-[3px]">
          {BANDS.map((r) => (
            <button key={r} type="button" aria-pressed={r === radius} onClick={() => onRadius(r)}
              className={cn('h-8 rounded-[7px] font-mono text-xs', r === radius ? 'bg-foreground font-semibold text-background' : 'text-foreground/80 hover:bg-foreground/5')}>
              {r} m
            </button>
          ))}
        </div>
      </div>
      {n < 2 ? (
        <p className="rounded-xl border bg-card p-3.5 text-[13px] text-muted-foreground">Select at least 2 transformers. Tick them in the list or Shift-click them on the map.</p>
      ) : failed ? (
        <div className="flex items-center justify-between gap-2 rounded-xl border bg-card p-3.5">
          <p className="text-[13px]">Couldn&apos;t load buildings</p>
          <Button variant="secondary" className="h-11" onClick={onRetry}>Retry</Button>
        </div>
      ) : !stats ? (
        <p className="rounded-xl bg-card p-3.5 text-[13px] text-muted-foreground">Loading building footprints — overlap counts appear in a moment.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Stat inverted label={`Shared by 2+ within ${radius} m`} value={fmt(stats.shared[ri])} />
            <Stat label="Unique buildings covered" value={fmt(stats.covered[ri])} />
          </div>
          <p className="text-[12.5px] leading-normal text-muted-foreground">
            Adding each transformer&apos;s own count within {radius} m gives {fmt(sumIn)}; {fmt(sumIn - stats.covered[ri])} of those are double counts from overlapping rings.
            {stats.shared[ri] === 0 && !ringsIntersect(selected, radius) && ' These rings don’t intersect.'}
          </p>
          <div className="overflow-hidden rounded-[14px] border" role="table" aria-label="Overlap by radius">
            <div role="row" className={`${grid} bg-card text-[11.5px] text-muted-foreground`}>
              <span role="columnheader">Within</span><span role="columnheader" className="text-right">Covered</span><span role="columnheader" className="text-right">Shared</span>
            </div>
            {BANDS.map((r, i) => (
              <div key={r} role="row" className={cn(grid, 'border-t border-foreground/[.06] text-[13px]', r === radius && 'bg-foreground/[.06]')}>
                <span role="cell" className="flex items-center gap-2"><span className="size-[9px] rounded-full" style={{ background: BAND_COLORS[i] }} /><span className="font-mono">≤{r} m</span></span>
                <span role="cell" className="text-right font-mono">{fmt(stats.covered[i])}</span>
                <span role="cell" className="text-right font-mono">{fmt(stats.shared[i])}</span>
              </div>
            ))}
          </div>
          <div className="overflow-hidden rounded-[14px] border" role="table" aria-label="Overlap by transformer">
            <div role="row" className={`${grid} bg-card text-[11.5px] text-muted-foreground`}>
              <span role="columnheader">Transformer · {radius} m</span><span role="columnheader" className="text-right">In range</span><span role="columnheader" className="text-right">Only this</span>
            </div>
            {selected.map((t, j) => (
              <div key={t.id} role="row" className={`${grid} border-t border-foreground/[.06] text-[13px]`}>
                <span role="cell" className="truncate">{t.name}</span>
                <span role="cell" className="text-right font-mono">{fmt(stats.inRange[ri][j])}</span>
                <span role="cell" className="text-right font-mono text-foreground/80">{fmt(stats.only[ri][j])}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
