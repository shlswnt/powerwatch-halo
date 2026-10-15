import type { ReactNode } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

export function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="text-[11.5px] uppercase tracking-[0.06em] text-muted-foreground">{children}</p>
}

export function Stat({ label, value, inverted = false }: { label: string; value: string; inverted?: boolean }) {
  return (
    <div className={inverted ? 'flex flex-col gap-1 rounded-lg bg-foreground p-3 text-background' : 'flex flex-col gap-1 rounded-lg border bg-card p-3'}>
      <span className={inverted ? 'text-[11.5px] leading-tight opacity-75' : 'whitespace-nowrap text-[11px] text-muted-foreground'}>{label}</span>
      <span className="font-mono text-xl leading-none font-medium tabular-nums">{value}</span>
    </div>
  )
}

export const fmt = (n: number) => n.toLocaleString('en-US')

/**
 * Both details cards share this layout, like the left panel: a pinned summary, a divider, then the body, which is the
 * only part that scrolls (its scrollbar starts at the divider). 16 px around, 12 px between blocks.
 * The side-by-side layout is a container query on the desktop pane (the @container is on that pane, in Dashboard): in
 * the wide landscape pane along the bottom of the map, the summary is a left column and the body's blocks sit beside
 * it. The phone sheet has no container, so there everything always stacks, at any width (tablets included).
 * On phones the body is padded by --sheet-offset (set by the details sheet), so its end clears a half-height sheet.
 */
export function DetailsLayout({ label, summary, children, bodyClassName, fill = false }: {
  label: string
  summary: ReactNode
  children: ReactNode
  bodyClassName?: string
  /** The body fills the area beside the summary at any side-by-side width (e.g. to centre an empty state). */
  fill?: boolean
}) {
  return (
    <section aria-label={label} className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col @min-[40rem]:flex-row">
        <ScrollArea data-testid="details-summary" className="shrink-0 @min-[40rem]:min-h-0 @min-[40rem]:w-72" contentClassName="@min-[40rem]:h-full">
          <div className="flex flex-col gap-3 p-4 @min-[40rem]:h-full">{summary}</div>
        </ScrollArea>
        <ScrollArea data-testid="details-body-scroll" className="min-h-0 flex-1 border-t @min-[40rem]:border-t-0 @min-[40rem]:border-l" contentClassName={fill ? '@min-[40rem]:h-full' : '@min-[58rem]:h-full'}>
          <div className={cn('flex flex-col gap-3 p-4 pb-[calc(var(--sheet-offset,0px)+1rem)] @min-[58rem]:grid @min-[58rem]:grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] @min-[58rem]:items-start', fill && '@min-[40rem]:h-full', bodyClassName)}>{children}</div>
        </ScrollArea>
      </div>
    </section>
  )
}
