import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cumulative } from '@/lib/counts'
import { BAND_COLORS } from '@/lib/map-style'
import type { Settings } from '@/lib/settings'
import { townById } from '@/lib/towns'
import { BANDS, type Transformer } from '@/lib/types'
import { SectionLabel, fmt } from './common'
import { WaterfallChart } from './waterfall-chart'

interface Props {
  t: Transformer
  settings: Settings
  onStep: (dir: 1 | -1) => void
  onCompareNearby: () => void
}

const chip = 'rounded-md px-2 py-[3px] text-xs'

export function TransformerDetails({ t, settings, onStep, onCompareNearby }: Props) {
  const cumAll = cumulative(t.rings.all)
  const cumHi = cumulative(t.rings.hi)
  const range = settings.countMode === 'range'
  const hiLine = (n: number) => range && <span className="block text-[11px] text-muted-foreground">{fmt(n)} high-conf.</span>
  return (
    <section aria-label="Transformer details" className="flex flex-col gap-3.5 px-4 pb-6 pt-4">
      <div className="grid grid-cols-[36px_minmax(0,1fr)_36px] items-center gap-1 rounded-[14px] border bg-card px-1.5 py-3">
        <Button variant="ghost" size="icon" className="size-9 text-muted-foreground" aria-label="Previous transformer" onClick={() => onStep(-1)}><ChevronLeft /></Button>
        <div className="flex min-w-0 flex-col items-center gap-0.5 text-center">
          <h2 className="max-w-full truncate text-lg font-semibold tracking-tight">{t.name}</h2>
          <span className="text-[12.5px] text-muted-foreground">{townById(t.town).name} · {t.id}</span>
        </div>
        <Button variant="ghost" size="icon" className="size-9 text-muted-foreground" aria-label="Next transformer" onClick={() => onStep(1)}><ChevronRight /></Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <span className={`${chip} bg-secondary`}>{t.kva ? `${fmt(t.kva)} kVA` : 'Capacity not recorded'}</span>
        <span className={`${chip} border font-mono text-[11.5px] text-foreground/80`}>{t.lat.toFixed(5)}, {t.lon.toFixed(5)}</span>
        <span className={`${chip} border text-foreground/80`}>{t.layer === 'freetown' ? 'Freetown layer' : 'Outside Freetown layer'}</span>
      </div>
      <div className="flex flex-col gap-1 rounded-[14px] border bg-card p-4">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[26px] font-semibold tracking-tight tabular-nums">{fmt(cumAll[4])}</span>
          <span className="text-[13px] text-muted-foreground">buildings within 500 m</span>
        </div>
        <WaterfallChart rings={t.rings.all} />
      </div>
      <div className="overflow-hidden rounded-[14px] border" role="table" aria-label="Buildings per band">
        <div role="row" className="grid grid-cols-[minmax(0,1fr)_80px_90px] gap-2 bg-card px-3.5 py-2 text-[11.5px] text-muted-foreground">
          <span role="columnheader">Band</span><span role="columnheader" className="text-right">In band</span><span role="columnheader" className="text-right">Cumulative</span>
        </div>
        {BANDS.map((r, i) => (
          <div key={r} role="row" className="grid grid-cols-[minmax(0,1fr)_80px_90px] items-center gap-2 border-t border-foreground/[.06] px-3.5 py-2 text-[13px]">
            <span role="cell" className="flex items-center gap-2"><span className="size-[9px] rounded-full" style={{ background: BAND_COLORS[i] }} /><span className="font-mono">{i * 100}–{r} m</span></span>
            <span role="cell" className="text-right font-mono">{fmt(t.rings.all[i])}{hiLine(t.rings.hi[i])}</span>
            <span role="cell" className="text-right font-mono text-foreground/80">{fmt(cumAll[i])}{hiLine(cumHi[i])}</span>
          </div>
        ))}
      </div>
      {t.description && (
        <div className="flex flex-col gap-1.5">
          <SectionLabel>Field notes</SectionLabel>
          <p className="m-0 whitespace-pre-line rounded-xl border bg-card px-3.5 py-3 text-[12.5px] leading-relaxed text-foreground/85">{t.description}</p>
        </div>
      )}
      <Button variant="outline" className="h-[38px] text-[13px] font-medium" onClick={onCompareNearby}>Compare with nearby transformers</Button>
    </section>
  )
}
