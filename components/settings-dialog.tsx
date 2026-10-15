'use client'

import { useTheme } from 'next-themes'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
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

export function SettingsDialog({ open, onOpenChange, settings, onChange, meta }: Props) {
  const { theme, setTheme } = useTheme()
  const toggles: { key: 'labels' | 'footprints' | 'rings'; label: string }[] = [
    { key: 'labels', label: 'Map labels' },
    { key: 'footprints', label: 'Building footprints' },
    { key: 'rings', label: 'Rings' },
  ]
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Saved in this browser.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Label>Theme</Label>
          <ToggleGroup variant="outline" value={[theme ?? 'system']} onValueChange={(v) => v[0] && setTheme(v[0])} className="w-full">
            <ToggleGroupItem value="light" className="h-11 flex-1">Light</ToggleGroupItem>
            <ToggleGroupItem value="dark" className="h-11 flex-1">Dark</ToggleGroupItem>
            <ToggleGroupItem value="system" className="h-11 flex-1">Auto</ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="flex flex-col gap-2">
          <Label>Counts shown</Label>
          <ToggleGroup variant="outline" value={[settings.countMode]} onValueChange={(v) => v[0] && onChange({ ...settings, countMode: v[0] as CountMode })} className="w-full">
            <ToggleGroupItem value="range" className="h-11 flex-1">Range</ToggleGroupItem>
            <ToggleGroupItem value="all" className="h-11 flex-1">All</ToggleGroupItem>
            <ToggleGroupItem value="hi" className="h-11 flex-1">High-confidence</ToggleGroupItem>
          </ToggleGroup>
        </div>

        {toggles.map(({ key, label }) => (
          <div key={key} className="flex min-h-11 items-center justify-between">
            <Label htmlFor={`setting-${key}`}>{label}</Label>
            <Switch id={`setting-${key}`} checked={settings[key]} onCheckedChange={(v) => onChange({ ...settings, [key]: v })} />
          </div>
        ))}

        <Separator />
        <div className="text-xs text-muted-foreground">
          <p className="font-medium text-foreground">About the data</p>
          {meta ? (
            <p>
              Built {new Date(meta.builtAt).toLocaleDateString()} · {meta.transformerCount} transformers · {meta.buildingCount.toLocaleString('en-US')} buildings · {meta.source}
            </p>
          ) : (
            <p>Data details unavailable.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
