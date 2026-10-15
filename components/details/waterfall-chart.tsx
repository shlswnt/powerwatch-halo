import { Fragment } from 'react'
import { tickLabel, waterfall } from '@/lib/chart'
import { BAND_COLORS } from '@/lib/map-style'
import type { Rings } from '@/lib/types'
import { fmt } from './common'

export function WaterfallChart({ rings }: { rings: Rings }) {
  const { bars, top, ticks } = waterfall(rings)
  const col = 100 / bars.length
  const pct = (v: number) => `${(v / top) * 100}%`
  return (
    <figure aria-label="Buildings per band, stacked" className="m-0 pt-[18px]">
      <div className="relative h-[170px]">
        {ticks.map((v) => (
          <Fragment key={v}>
            <div className="absolute left-[34px] right-0 border-t border-dashed border-foreground/10" style={{ bottom: pct(v) }} />
            <div className="absolute left-0 w-[30px] translate-y-1/2 text-right font-mono text-[10px] text-muted-foreground" style={{ bottom: pct(v) }}>
              {tickLabel(v)}
            </div>
          </Fragment>
        ))}
        <div className="absolute inset-y-0 left-10 right-0">
          {bars.map((b, i) => (
            <Fragment key={b.label}>
              <div className="absolute min-h-[2px] rounded-[3px]" data-band={b.band ?? 'total'}
                style={{ left: `${i * col + col * 0.2}%`, width: `${col * 0.6}%`, bottom: pct(b.from), height: pct(b.to - b.from), background: b.band === null ? 'var(--chart-total)' : BAND_COLORS[b.band] }} />
              <div className="absolute pb-1 text-center font-mono text-[10.5px]" style={{ left: `${i * col}%`, width: `${col}%`, bottom: pct(b.to) }}>
                {fmt(b.value)}
              </div>
            </Fragment>
          ))}
        </div>
      </div>
      <div className="ml-10 mt-2 grid grid-cols-6">
        {bars.map((b) => <span key={b.label} className="text-center font-mono text-[10.5px] text-muted-foreground">{b.label}</span>)}
      </div>
    </figure>
  )
}
