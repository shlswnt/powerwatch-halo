'use client'

import { Bell, CircleAlert, TriangleAlert } from 'lucide-react'
import { MAP_BUTTON, PANEL_SURFACE } from '@/components/map-chrome'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { NoteState } from '@/lib/notifications'

interface Props {
  notes: NoteState
  onOpen: () => void
  onClear: () => void
  onRetry: () => void
}

export function NotificationsButton({ notes, onOpen, onClear, onRetry }: Props) {
  return (
    <Popover onOpenChange={(open) => open && onOpen()}>
      <PopoverTrigger
        render={<Button size="icon" variant="ghost" className={`relative ${MAP_BUTTON} shadow-sm`} aria-label={`Notifications, ${notes.unread} unread`} />}>
        <Bell />
        {notes.unread > 0 && (
          <span aria-hidden className="absolute -right-1 -top-1 min-w-5 rounded-full bg-destructive px-1 text-center text-[10px] font-semibold leading-5 text-white">
            {notes.unread}
          </span>
        )}
      </PopoverTrigger>
      {/* Opens to the left of the bell, styled like the details panel. */}
      <PopoverContent side="left" align="start" sideOffset={12}
        className={`w-80 max-w-[calc(100vw-1.5rem)] gap-0 p-0 ring-0 ${PANEL_SURFACE}`}>
        <div className="flex h-12 shrink-0 items-center justify-between border-b pl-4 pr-1.5">
          <span className="text-[11.5px] uppercase tracking-[0.06em] text-muted-foreground">Notifications</span>
          {notes.items.length > 0 && <Button variant="ghost" size="sm" onClick={onClear}>Clear</Button>}
        </div>
        {notes.items.length === 0 ? (
          <p className="p-4 text-muted-foreground">Nothing to report.</p>
        ) : (
          <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto p-3">
            {notes.items.map((n) => {
              const Icon = n.severity === 'error' ? CircleAlert : TriangleAlert
              return (
                <li key={n.id} className="flex items-start gap-2 rounded-md bg-muted/50 p-2">
                  <Icon className={n.severity === 'error' ? 'mt-0.5 size-4 shrink-0 text-destructive' : 'mt-0.5 size-4 shrink-0 text-amber-500'} aria-label={n.severity} />
                  <div className="min-w-0 flex-1">
                    <p className="break-words">{n.message}{n.count > 1 && ` (×${n.count})`}</p>
                    <p className="text-xs text-muted-foreground">{new Date(n.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  {n.retry && <Button size="sm" variant="secondary" onClick={onRetry}>Retry</Button>}
                </li>
              )
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}
