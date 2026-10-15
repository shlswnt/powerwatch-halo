/** Map overlays: one frosted, see-through surface that follows the theme (CSS variables in globals.css). */
// The outline is a hairline drawn over the control's own surface (bg-clip-border), in the opposite tone (--map-border):
// light on dark, dark on light. Drawn over the map instead, it would come and go with the imagery underneath.
export const MAP_SURFACE = 'border border-[var(--map-border)] bg-[var(--map-surface)] bg-clip-border text-[var(--map-fg)] backdrop-blur-md'

const BUTTON_BG =
  'bg-[var(--map-surface)] text-[var(--map-fg)] backdrop-blur-md hover:bg-[var(--map-surface-hover)] hover:text-[var(--map-fg)] ' +
  'dark:hover:bg-[var(--map-surface-hover)] aria-expanded:bg-[var(--map-surface-hover)] aria-expanded:text-[var(--map-fg)]'

/** A 44 px map button (use with Button variant="ghost"). */
export const MAP_BUTTON = `size-11 rounded-lg border border-[var(--map-border)] bg-clip-border ${BUTTON_BG}`

/** A segment of the joined zoom pill. The pill draws the border and the one frosted background, so the segments stay
    see-through (no map showing between them) and only tint on hover; 42 px + the pill's border = a 44 px map button. */
export const MAP_PILL_BUTTON =
  'size-[42px] rounded-none border-0 bg-transparent text-[var(--map-fg)] hover:bg-[var(--map-surface-hover)] hover:text-[var(--map-fg)] ' +
  'dark:hover:bg-[var(--map-surface-hover)]'

/** Solid floating panel over the map: the details card and the notifications popup. 10 px radius like the map buttons,
    so with their 10 px inset they nest evenly inside the map's 20 px corners. */
export const PANEL_SURFACE = 'rounded-lg border bg-background shadow-[0_20px_50px_rgba(0,0,0,0.35)]'

/** The slide used by the floating panels and the map controls that move with them. */
export const SLIDE = 'transition-transform duration-300 ease-out motion-reduce:transition-none'
