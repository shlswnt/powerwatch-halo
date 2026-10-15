import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cumulative } from '@/lib/counts'
import { townById } from '@/lib/towns'
import type { Transformer } from '@/lib/types'
import { cn } from '@/lib/utils'
import { DetailsLayout, SectionLabel, fmt } from './common'
import { WaterfallChart } from './waterfall-chart'

interface Props {
  t: Transformer
  onStep: (dir: 1 | -1) => void
  /** How many other transformers are within 500 m. */
  nearby: number
  onCompareNearby: () => void
}

const chip = 'rounded-md px-2 py-[3px] text-xs'
// Contents fade in when the transformer changes (swap-in in globals.css); the cards around them stay put.
const swap = 'swap-in'

export function TransformerDetails({ t, nearby, onStep, onCompareNearby }: Props) {
  const cumAll = cumulative(t.rings.all)
  // Which arrow brought this transformer in (0 when it came from the list or map), so its name slides in from that side.
  const [arrow, setArrow] = useState<-1 | 0 | 1>(0)
  const [shown, setShown] = useState({ id: t.id, dir: 0 })
  if (shown.id !== t.id) {
    setShown({ id: t.id, dir: arrow })
    setArrow(0)
  }
  const step = (dir: 1 | -1) => {
    setArrow(dir)
    onStep(dir)
  }
  return (
    <DetailsLayout label="Transformer details" summary={<>
      <div className="grid grid-cols-[36px_minmax(0,1fr)_36px] items-center gap-1 rounded-lg border bg-card px-1.5 py-3">
        <Button variant="ghost" size="icon" className="size-9 text-muted-foreground" aria-label="Previous transformer" onClick={() => step(-1)}><ChevronLeft /></Button>
        <div className="min-w-0 overflow-hidden">
        <div key={t.id} data-testid="name-switcher" data-from={shown.dir === 1 ? 'right' : shown.dir === -1 ? 'left' : undefined}
          className={cn('flex min-w-0 flex-col items-center gap-0.5 text-center', swap, shown.dir === 1 && 'swap-in-right', shown.dir === -1 && 'swap-in-left')}>
          <h2 className="max-w-full truncate text-lg font-semibold tracking-tight">{t.name}</h2>
          <span className="text-[12.5px] text-muted-foreground">{townById(t.town).name} · {t.id}</span>
        </div>
        </div>
        <Button variant="ghost" size="icon" className="size-9 text-muted-foreground" aria-label="Next transformer" onClick={() => step(1)}><ChevronRight /></Button>
      </div>
      <div key={t.id} className={cn('flex flex-wrap gap-1.5', swap)}>
        <span className={`${chip} bg-secondary`}>{t.kva ? `${fmt(t.kva)} kVA` : 'Unknown kVA'}</span>
        <span className={`${chip} border font-mono text-[11.5px] text-foreground/80`}>{t.lat.toFixed(5)}, {t.lon.toFixed(5)}</span>
        <span className={`${chip} border text-foreground/80`}>{t.layer === 'freetown' ? 'Freetown layer' : 'Outside Freetown layer'}</span>
      </div>
      {/* The main action, pinned to the bottom of the summary column in the wide pane. */}
      <Button variant="outline" className="h-11 text-[13px] font-medium @min-[40rem]:mt-auto" disabled={nearby === 0} onClick={onCompareNearby}>
        {nearby === 0 ? 'No other transformers within 500 m' : `Compare with ${nearby} nearby (within 500 m)`}
      </Button>
    </>} bodyClassName="@min-[58rem]:h-full @min-[58rem]:grid-cols-[minmax(17rem,1fr)_minmax(0,1.5fr)] @min-[58rem]:items-stretch">
      <div data-testid="chart-card" className="flex flex-col gap-1 rounded-lg border bg-card p-4">
        <div className="flex items-baseline gap-2">
          <span key={t.id} className={cn(swap, 'font-mono text-[26px] font-semibold tracking-tight tabular-nums')}>{fmt(cumAll[4])}</span>
          <span className="text-[13px] text-muted-foreground">buildings within 500 m</span>
        </div>
        <WaterfallChart rings={t.rings.all} />
      </div>
      {/* Field notes beside the chart, wider. In the wide pane the box fills the pane's height and only its text scrolls. */}
      {/* One box like the chart card: its title inside, 16 px padding, the same top and bottom as the chart. Only the
          text below the title scrolls; the scrollbar is inset to clear the rounded corners. */}
      <div data-testid="field-notes" className="flex min-h-0 flex-col rounded-lg border bg-card">
        <div className="shrink-0 px-4 pt-4 pb-2"><SectionLabel>Field notes</SectionLabel></div>
        <ScrollArea key={t.id} className="min-h-0 flex-1 [&>[data-slot=scroll-area-scrollbar]]:top-0! [&>[data-slot=scroll-area-scrollbar]]:bottom-1.5! [&>[data-slot=scroll-area-scrollbar]]:right-1! [&>[data-slot=scroll-area-scrollbar]]:h-auto!">
          <p className={cn(swap, 'm-0 whitespace-pre-line px-4 pb-4 text-[12.5px] leading-relaxed', t.description ? 'text-foreground/85' : 'text-muted-foreground')}>
            {t.description || 'No field notes for this transformer.'}
          </p>
        </ScrollArea>
      </div>
    </DetailsLayout>
  )
}
