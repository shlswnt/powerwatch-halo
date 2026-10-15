'use client'

import { FileText, Map as MapIcon, Settings, Zap } from 'lucide-react'
import type { ReactNode } from 'react'
import { NlineMark } from '@/components/logo'
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarRail,
} from '@/components/ui/sidebar'

interface Props {
  /** The transformer list (search, Sort, Compare, rows). */
  children: ReactNode
  onHome: () => void
  onSettings: () => void
}

const RAIL_BUTTON = 'size-11! justify-center rounded-[10px] p-0! text-muted-foreground group-data-[collapsible=icon]:size-11! group-data-[collapsible=icon]:p-0! [&_svg]:size-5'
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
      <Sidebar collapsible="none"
        className="hidden w-[calc(var(--sidebar-width)-var(--sidebar-width-icon)-2px)] shrink-0 transition-[translate,visibility] duration-200 ease-linear md:flex group-data-[collapsible=icon]:invisible group-data-[collapsible=icon]:-translate-x-full">
        <PanelBody>{children}</PanelBody>
      </Sidebar>
      <SidebarRail />
    </Sidebar>
  )
}

/** Phones: the sheet has the same icon rail down its left edge, beside the panel. */
export function MobileSidebar({ children, onHome, onSettings }: Props) {
  return (
    <Sidebar variant="inset">
      <div className="flex h-full">
        <div className="w-[65px] shrink-0 border-r border-sidebar-border">
          <RailNav onHome={onHome} onSettings={onSettings} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <PanelBody>{children}</PanelBody>
        </div>
      </div>
    </Sidebar>
  )
}

/** The mockup's icon rail: logo, Map, coming-soon items, and Settings at the bottom. */
function RailNav({ onHome, onSettings }: Omit<Props, 'children'>) {
  return (
    <nav aria-label="Main" className="flex h-full flex-col items-center pb-3">
      {/* Rows line up across rail, panel and map: logo, title and the map's 44 px buttons share the row 18–62 px
          (8 px inset margin + 10 px button margin), whose bottom is the title divider; Map lines up with the 38 px
          search row (62 + 16 group padding + 19 = 97 = 62 + 13 + 22). */}
      <div className="flex h-[62px] shrink-0 items-center pt-[18px]">
        <div className="flex size-9 items-center justify-center rounded-[10px] border bg-background text-foreground">
          <NlineMark className="size-6" />
        </div>
      </div>
      <SidebarMenu className="items-center gap-2 pt-[13px]">
        <SidebarMenuItem>
          <SidebarMenuButton isActive className={RAIL_BUTTON} tooltip={{ children: 'Map', hidden: false }} onClick={onHome}>
            <MapIcon /><span className="sr-only">Map</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton aria-disabled className={`${RAIL_BUTTON} ${SOON}`} tooltip={{ children: 'Instrumentation sites · Coming soon', hidden: false }}>
            <Zap /><span className="sr-only">Instrumentation sites</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton aria-disabled className={`${RAIL_BUTTON} ${SOON}`} tooltip={{ children: 'Reports · Coming soon', hidden: false }}>
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

function PanelBody({ children }: { children: ReactNode }) {
  return (
    <>
      <SidebarHeader className="h-[62px] shrink-0 justify-center border-b border-sidebar-border px-4 pt-[18px] pb-0">
        <h1 className="text-[15px] font-semibold leading-tight tracking-tight">PowerWatch Halo</h1>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="p-4">{children}</SidebarGroup>
      </SidebarContent>
    </>
  )
}
