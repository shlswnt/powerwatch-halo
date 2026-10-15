import type { CountMode } from './counts'

export interface Settings {
  countMode: CountMode
  labels: boolean
  footprints: boolean
  rings: boolean
}

export const DEFAULT_SETTINGS: Settings = { countMode: 'all', labels: true, footprints: true, rings: true }

const KEY = 'pwh-settings'
const MODES: CountMode[] = ['range', 'all', 'hi']

export function safeStorage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage
  } catch {
    return undefined
  }
}

export function loadSettings(storage: Pick<Storage, 'getItem'> | undefined): Settings {
  try {
    const raw = storage?.getItem(KEY)
    if (!raw) return DEFAULT_SETTINGS
    const p = JSON.parse(raw) as Record<string, unknown>
    const bool = (k: keyof Settings) => (typeof p[k] === 'boolean' ? (p[k] as boolean) : (DEFAULT_SETTINGS[k] as boolean))
    return {
      countMode: MODES.includes(p.countMode as CountMode) ? (p.countMode as CountMode) : DEFAULT_SETTINGS.countMode,
      labels: bool('labels'),
      footprints: bool('footprints'),
      rings: bool('rings'),
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(v: Settings, storage: Pick<Storage, 'setItem'> | undefined): void {
  try {
    storage?.setItem(KEY, JSON.stringify(v))
  } catch {
    // Storage blocked or full: settings just won't persist.
  }
}
