import type { ReactNode } from 'react'

export function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="text-[11.5px] uppercase tracking-[0.06em] text-muted-foreground">{children}</p>
}

export function Stat({ label, value, inverted = false }: { label: string; value: string; inverted?: boolean }) {
  return (
    <div className={inverted ? 'flex flex-col gap-1 rounded-xl bg-foreground p-3.5 text-background' : 'flex flex-col gap-1 rounded-xl border bg-card p-3'}>
      <span className={inverted ? 'text-[11.5px] leading-tight opacity-75' : 'whitespace-nowrap text-[11px] text-muted-foreground'}>{label}</span>
      <span className="font-mono text-xl font-medium tabular-nums">{value}</span>
    </div>
  )
}

export const fmt = (n: number) => n.toLocaleString('en-US')
