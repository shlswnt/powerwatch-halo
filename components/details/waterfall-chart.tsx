import { Fragment } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { tickLabel, waterfall } from '@/lib/chart'
import { BAND_COLORS } from '@/lib/map-style'
import { BANDS, type Rings } from '@/lib/types'
import { cn } from '@/lib/utils'
import { fmt } from './common'

// Everything moves with transforms only, so it stays smooth while the map flies. Each piece sits on a full-height
// track whose bottom edge is lifted to its value (translateY of the track's own height, i.e. the chart's); overflow goes
// upward, where it can't make the pane scroll. Bars grow with scaleY from their base.
const glide = 'transition-transform duration-500 ease-out motion-reduce:transition-none'
const track = cn('pointer-events-none absolute inset-y-0', glide)
const lift = (f: number) => ({ transform: `translateY(${-f * 100}%)` })

/**
 * Buildings per 100 m band, stacked into the running total, then the Total bar. It carries everything the old band
 * table did: the in-band count above each bar, each band's share of the total under its label, and the running total
 * on hover or focus (each bar is a labelled button, so screen readers get every number too).
 */
export function WaterfallChart({ rings }: { rings: Rings }) {
  const { bars, top, ticks } = waterfall(rings)
  const total = bars[bars.length - 1].to
  const share = (n: number) => `${total ? Math.round((n / total) * 100) : 0}%`
  const detail = (i: number) =>
    `${i * 100}–${BANDS[i]} m: ${fmt(rings[i])} buildings in this band, ${fmt(bars[i].to)} within ${BANDS[i]} m, ${share(rings[i])} of all`
  const col = 100 / bars.length
  return (
    <figure aria-label="Buildings per band, stacked" className="m-0 pt-[18px]">
      {/* Shorter in the wide landscape pane (a container query on the details layout), so the card fits its height. */}
      <div className="relative h-[170px] @min-[58rem]:h-[108px]">
        {/* Keyed by position, so when the scale changes the gridlines glide to their new values. */}
        {ticks.map((v, i) => (
          <div key={i} className={cn(track, 'inset-x-0')} style={lift(v / top)}>
            <div className="absolute bottom-0 left-[34px] right-0 border-b border-dashed border-foreground/10" />
            <div className="absolute bottom-0 left-0 w-[30px] translate-y-1/2 text-right font-mono text-[10px] text-muted-foreground">{tickLabel(v)}</div>
          </div>
        ))}
        <div className="absolute inset-y-0 left-10 right-0">
          {bars.map((b, i) => (
            <Fragment key={b.label}>
              <div className={track} style={{ left: `${i * col + col * 0.2}%`, width: `${col * 0.6}%`, ...lift(b.from / top) }}>
                {/* At least 2 px tall (of the shorter, 108 px chart) so an empty band still shows. */}
                <div className={cn('absolute inset-0 origin-bottom rounded-[3px]', glide)} data-band={b.band ?? 'total'}
                  style={{ transform: `scaleY(${Math.max((b.to - b.from) / top, 2 / 108)})`, background: b.band === null ? 'var(--chart-total)' : BAND_COLORS[b.band] }} />
              </div>
              <div className={track} style={{ left: `${i * col}%`, width: `${col}%`, ...lift(b.to / top) }}>
                <div className="absolute inset-x-0 bottom-0 pb-1 text-center font-mono text-[10.5px]">{fmt(b.value)}</div>
              </div>
              {b.band !== null && (
                <Tooltip>
                  <TooltipTrigger render={<button type="button" aria-label={detail(b.band)}
                    className="absolute inset-y-0 rounded-md outline-none hover:bg-foreground/[.04] focus-visible:ring-2 focus-visible:ring-ring/50"
                    style={{ left: `${i * col}%`, width: `${col}%` }} />} />
                  <TooltipContent>{detail(b.band)}</TooltipContent>
                </Tooltip>
              )}
            </Fragment>
          ))}
        </div>
      </div>
      <div className="ml-10 mt-2 grid grid-cols-6">
        {bars.map((b) => (
          <span key={b.label} className="flex flex-col items-center font-mono text-[10.5px] leading-tight text-muted-foreground">
            <span>{b.label}</span>
            <span className="text-foreground/70">{b.band === null ? '100%' : share(b.value)}</span>
          </span>
        ))}
      </div>
    </figure>
  )
}
