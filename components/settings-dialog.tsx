'use client'

import { Radio } from '@base-ui/react/radio'
import { RadioGroup } from '@base-ui/react/radio-group'
import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react'
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

// Hints are kept short enough to stay on one line on a phone.
const LAYERS: { key: 'labels' | 'footprints' | 'rings'; label: string; hint: string }[] = [
  { key: 'labels', label: 'Map labels', hint: 'Place, road and landmark names' },
  { key: 'footprints', label: 'Building footprints', hint: 'Coloured by distance band' },
  { key: 'rings', label: 'Rings', hint: '100–500 m distance rings' },
]

/** A settings section: a small heading, then its controls. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
      {children}
    </section>
  )
}

/** A labelled switch with a one-line hint. */
function SwitchRow({ id, label, hint, checked, onChange }: { id: string; label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-3 px-3 py-1.5">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Label htmlFor={id}>{label}</Label>
        <span className="truncate text-xs text-muted-foreground">{hint}</span>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

/** One segmented control style for theme and counts: a muted track, the chosen option raised. */
const SEGMENT = 'flex h-8 items-center justify-center gap-1.5 truncate rounded-md px-2 text-sm font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-checked:bg-background data-checked:text-foreground data-checked:shadow-sm'

/** Settings as a compact shadcn-style block that fits a phone screen without scrolling: Appearance (theme, reduce
    motion), Counts, Map layers (one card of switches) and About the data. Choices are kept in this browser. */
export function SettingsDialog({ open, onOpenChange, settings, onChange, meta }: Props) {
  const { theme, setTheme } = useTheme()
  const count = COUNTS.find((c) => c.value === settings.countMode) ?? COUNTS[0]
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-3.5 overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <Section title="Appearance">
          <RadioGroup aria-label="Theme" value={theme ?? 'system'} onValueChange={(v) => setTheme(String(v))} className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
            {THEMES.map(({ value, label, icon: Icon }) => (
              <Radio.Root key={value} value={value} nativeButton render={<button type="button" />} className={SEGMENT}>
                <Icon className="size-4" />{label}
              </Radio.Root>
            ))}
          </RadioGroup>
          <div className="rounded-lg border">
            <SwitchRow id="setting-motion" label="Reduce motion" hint="Turn off animations and camera flights" checked={settings.reduceMotion}
              onChange={(v) => onChange({ ...settings, reduceMotion: v })} />
          </div>
        </Section>

        <Section title="Counts">
          <RadioGroup aria-label="Counts shown" value={settings.countMode} onValueChange={(v) => onChange({ ...settings, countMode: v as CountMode })}
            className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
            {COUNTS.map(({ value, label }) => (
              <Radio.Root key={value} value={value} nativeButton render={<button type="button" />} className={SEGMENT}>
                {label}
              </Radio.Root>
            ))}
          </RadioGroup>
          <p className="text-xs text-muted-foreground">{count.hint}</p>
        </Section>

        <Section title="Map layers">
          <div data-testid="map-layers" className="divide-y rounded-lg border">
            {LAYERS.map(({ key, label, hint }) => (
              <SwitchRow key={key} id={`setting-${key}`} label={label} hint={hint} checked={settings[key]} onChange={(v) => onChange({ ...settings, [key]: v })} />
            ))}
          </div>
        </Section>

        <Section title="About the data">
          <div data-testid="about-data" className="rounded-lg bg-muted/60 p-3 text-xs">
            {meta ? (
              // Three facts side by side (each label over its value), then the source across the full width.
              <dl className="grid grid-cols-[auto_auto_auto] justify-between gap-x-3 gap-y-0.5">
                <dt className="row-start-1 text-muted-foreground">Updated</dt><dd className="row-start-2 whitespace-nowrap">{new Date(meta.builtAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</dd>
                <dt className="row-start-1 text-muted-foreground">Transformers</dt><dd className="row-start-2 font-mono tabular-nums">{meta.transformerCount.toLocaleString('en-US')}</dd>
                <dt className="row-start-1 text-muted-foreground">Buildings</dt><dd className="row-start-2 font-mono tabular-nums">{meta.buildingCount.toLocaleString('en-US')}</dd>
                <dt className="col-span-3 mt-1.5 text-muted-foreground">Source</dt><dd className="col-span-3 leading-snug">{meta.source}</dd>
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
