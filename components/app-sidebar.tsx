'use client'

import { FileText, Map as MapIcon, Settings, X, Zap } from 'lucide-react'
import type { ReactNode } from 'react'
import { NlineMark } from '@/components/logo'
import { Button } from '@/components/ui/button'
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarRail, useSidebar,
} from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'

interface Props {
  /** The transformer list (search, Sort, Compare, rows). */
  children: ReactNode
  onHome: () => void
  onSettings: () => void
}

/** The top row of rail and panel. Desktop: 62 px with the content in its lower 44 px, level with the map's buttons.
    Phone sheet: 64 px, so the 36 px logo has the same 14 px above and below it as to its left (64 px rail). */
const HEADER_ROW = 'h-[62px] pt-[18px]'
const HEADER_ROW_PHONE = 'h-16 pt-0'
const RAIL_BUTTON = 'size-11! justify-center rounded-lg p-0! text-muted-foreground group-data-[collapsible=icon]:size-11! group-data-[collapsible=icon]:p-0! [&_svg]:size-5'
const SOON = 'aria-disabled:pointer-events-auto aria-disabled:cursor-not-allowed'

/**
 * shadcn inset sidebar built like the nested-sidebar block (sidebar-09): an icon rail as in the
 * mockup, then the "PowerWatch Halo" panel, framed by two vertical lines (the rail's, and the sidebar's own right
 * edge) with the title divider between them. Collapsing slides the panel left under the rail, so the right line
 * travels onto the left one. The panel keeps a fixed width, so the slide never re-lays out the list. The lines use
 * the opaque --sidebar-border, so where they overlap when collapsed they still read as one line.
 */
export function AppSidebar({ children, onHome, onSettings }: Props) {
  return (
    <Sidebar variant="inset" collapsible="icon"
      className="overflow-hidden p-0! group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+1px)]! *:data-[sidebar=sidebar]:flex-row *:data-[sidebar=sidebar]:border-r *:data-[sidebar=sidebar]:border-sidebar-border">
      <Sidebar collapsible="none" className="relative z-10 w-[calc(var(--sidebar-width-icon)+1px)]! shrink-0 border-r border-sidebar-border">
        <RailNav onHome={onHome} onSettings={onSettings} />
      </Sidebar>
      <Sidebar collapsible="none" data-testid="sidebar-panel"
        className="hidden w-[calc(var(--sidebar-width)-var(--sidebar-width-icon)-2px)] shrink-0 transition-[translate,visibility] duration-300 ease-out motion-reduce:transition-none md:flex group-data-[collapsible=icon]:invisible group-data-[collapsible=icon]:-translate-x-full">
        <PanelBody>{children}</PanelBody>
      </Sidebar>
      <SidebarRail />
    </Sidebar>
  )
}

/** Phones: the sheet has the same icon rail down its left edge, beside the panel. */
export function MobileSidebar({ children, onHome, onSettings }: Props) {
  const { setOpenMobile } = useSidebar()
  return (
    <Sidebar variant="inset">
      <div className="flex h-full">
        <div className="w-[65px] shrink-0 border-r border-sidebar-border">
          <RailNav onHome={onHome} onSettings={onSettings} phone />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <PanelBody onClose={() => setOpenMobile(false)}>{children}</PanelBody>
        </div>
      </div>
    </Sidebar>
  )
}

/** The mockup's icon rail: logo, Map, coming-soon items, and Settings at the bottom. */
function RailNav({ onHome, onSettings, phone = false }: Omit<Props, 'children'> & { phone?: boolean }) {
  return (
    <nav aria-label="Main" className="flex h-full flex-col items-center pb-3">
      {/* Rows line up across rail, panel and map: logo, title and the map's 44 px buttons share the row 18–62 px
          (8 px inset margin + 10 px button margin), whose bottom is the title divider. Map is the same 44 px as the
          search row and starts level with it: the 16 px group padding below the header. In the phone sheet there are
          no map buttons to line up with, so the header row is 64 px, and Map still starts 16 px below it. */}
      <div className={cn('flex shrink-0 items-center', phone ? HEADER_ROW_PHONE : HEADER_ROW)}>
        <div className="flex size-9 items-center justify-center rounded-lg border bg-background text-foreground">
          <NlineMark className="size-6" />
        </div>
      </div>
      <SidebarMenu className="items-center gap-2 pt-4">
        <SidebarMenuItem>
          <SidebarMenuButton isActive className={RAIL_BUTTON} tooltip={{ children: 'Map', hidden: false }} onClick={onHome}>
            <MapIcon /><span className="sr-only">Map</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton aria-disabled className={`${RAIL_BUTTON} ${SOON}`} tooltip={{ children: 'Instrumentation Sites', hidden: false }}>
            <Zap /><span className="sr-only">Instrumentation Sites</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton aria-disabled className={`${RAIL_BUTTON} ${SOON}`} tooltip={{ children: 'Reports', hidden: false }}>
            <FileText /><span className="sr-only">Reports</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
      <SidebarMenu className="mt-auto items-center">
        <SidebarMenuItem>
          <SidebarMenuButton className={RAIL_BUTTON} tooltip={{ children: 'Settings', hidden: false }} onClick={onSettings}>
            <Settings /><span className="sr-only">Settings</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </nav>
  )
}

/** With onClose (the phone sheet), the title row gets the same compact ✕ as the details pane, its icon on the 16 px
    content edge and a 44 px tap area. */
function PanelBody({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  return (
    <>
      <SidebarHeader className={cn('shrink-0 flex-row items-center justify-between gap-2 border-b border-sidebar-border pb-0 pl-4', onClose ? `${HEADER_ROW_PHONE} pr-2` : `${HEADER_ROW} pr-4`)}>
        <h1 className="text-[15px] font-semibold leading-tight tracking-tight">PowerWatch Halo</h1>
        {onClose && (
          <Button variant="ghost" size="icon" className="relative size-8 after:absolute after:-inset-1.5" aria-label="Close sidebar" onClick={onClose}><X /></Button>
        )}
      </SidebarHeader>
      {/* No scrolling here: the transformer rows scroll in their own box, so the search and controls stay put. */}
      <SidebarContent className="overflow-hidden">
        <SidebarGroup className="min-h-0 flex-1 p-4 pb-0">{children}</SidebarGroup>
      </SidebarContent>
    </>
  )
}
