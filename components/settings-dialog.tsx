'use client'

import { Radio } from '@base-ui/react/radio'
import { RadioGroup } from '@base-ui/react/radio-group'
import { Building2, CircleDot, Database, Monitor, Moon, Sun, Tags, Waves, type LucideIcon } from 'lucide-react'
import { useTheme } from 'next-themes'
import type { ReactNode } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { CountMode } from '@/lib/counts'
import type { Settings } from '@/lib/settings'
import type { Meta } from '@/lib/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  settings: Settings
  onChange: (s: Settings) => void
  meta: Meta | null
}

const THEMES: { value: string; label: string; icon: LucideIcon }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

const COUNTS: { value: CountMode; label: string; hint: string }[] = [
  { value: 'all', label: 'All', hint: 'Every building footprint in range.' },
  { value: 'hi', label: 'High Confidence', hint: 'Only buildings detected with high confidence.' },
]

const LAYERS: { key: 'labels' | 'footprints' | 'rings'; label: string; hint: string; icon: LucideIcon }[] = [
  { key: 'labels', label: 'Map labels', hint: 'Place, road and landmark names', icon: Tags },
  { key: 'footprints', label: 'Building footprints', hint: 'Outlines coloured by distance band', icon: Building2 },
  { key: 'rings', label: 'Rings', hint: '100–500 m distance rings around a transformer', icon: CircleDot },
]

/** A settings section: a small heading, then its controls. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
      {children}
    </section>
  )
}

/** Settings as a shadcn-style block: Appearance (theme cards, reduce motion), Counts (segmented), Map layers (one card of switches),
    and About the data (labelled facts). Choices are kept in this browser. */
export function SettingsDialog({ open, onOpenChange, settings, onChange, meta }: Props) {
  const { theme, setTheme } = useTheme()
  const count = COUNTS.find((c) => c.value === settings.countMode) ?? COUNTS[0]
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] gap-6 overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <Section title="Appearance">
          <RadioGroup aria-label="Theme" value={theme ?? 'system'} onValueChange={(v) => setTheme(String(v))} className="grid grid-cols-3 gap-2">
            {THEMES.map(({ value, label, icon: Icon }) => (
              <Radio.Root key={value} value={value} nativeButton render={<button type="button" />}
                className="flex flex-col items-center gap-2 rounded-lg border bg-card px-2 py-3 text-sm font-medium text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-checked:border-foreground data-checked:text-foreground data-checked:ring-1 data-checked:ring-foreground">
                <Icon className="size-5" />{label}
              </Radio.Root>
            ))}
          </RadioGroup>
          <div className="flex items-center gap-3 rounded-lg border px-3 py-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"><Waves className="size-4" /></span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <Label htmlFor="setting-motion">Reduce motion</Label>
              <span className="text-xs text-muted-foreground">Turn off animations and camera flights</span>
            </div>
            <Switch id="setting-motion" checked={settings.reduceMotion} onCheckedChange={(v) => onChange({ ...settings, reduceMotion: v })} />
          </div>
        </Section>

        <Section title="Counts">
          <RadioGroup aria-label="Counts shown" value={settings.countMode} onValueChange={(v) => onChange({ ...settings, countMode: v as CountMode })}
            className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
            {COUNTS.map(({ value, label }) => (
              <Radio.Root key={value} value={value} nativeButton render={<button type="button" />}
                className="h-8 truncate rounded-md px-2 text-sm font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-checked:bg-background data-checked:text-foreground data-checked:shadow-sm">
                {label}
              </Radio.Root>
            ))}
          </RadioGroup>
          <p className="text-xs text-muted-foreground">{count.hint}</p>
        </Section>

        <Section title="Map layers">
          <div data-testid="map-layers" className="divide-y rounded-lg border">
            {LAYERS.map(({ key, label, hint, icon: Icon }) => (
              <div key={key} className="flex items-center gap-3 px-3 py-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"><Icon className="size-4" /></span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <Label htmlFor={`setting-${key}`}>{label}</Label>
                  <span className="text-xs text-muted-foreground">{hint}</span>
                </div>
                <Switch id={`setting-${key}`} checked={settings[key]} onCheckedChange={(v) => onChange({ ...settings, [key]: v })} />
              </div>
            ))}
          </div>
        </Section>

        <Section title="About the data">
          <div data-testid="about-data" className="flex gap-3 rounded-lg bg-muted/60 p-3">
            <Database className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            {meta ? (
              <dl className="grid min-w-0 flex-1 grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
                <dt className="text-muted-foreground">Updated</dt><dd>{new Date(meta.builtAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</dd>
                <dt className="text-muted-foreground">Transformers</dt><dd className="font-mono tabular-nums">{meta.transformerCount.toLocaleString('en-US')}</dd>
                <dt className="text-muted-foreground">Buildings</dt><dd className="font-mono tabular-nums">{meta.buildingCount.toLocaleString('en-US')}</dd>
                <dt className="text-muted-foreground">Source</dt><dd className="leading-relaxed">{meta.source}</dd>
              </dl>
            ) : (
              <p className="text-xs text-muted-foreground">Data details unavailable.</p>
            )}
          </div>
        </Section>
      </DialogContent>
    </Dialog>
  )
}
