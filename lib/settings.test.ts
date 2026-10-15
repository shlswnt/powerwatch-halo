import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from './settings'

const store = (raw: string | null) => ({ getItem: () => raw })

describe('settings', () => {
  it('defaults to showing all buildings', () => expect(DEFAULT_SETTINGS.countMode).toBe('all'))
  it('defaults when storage is missing or empty', () => {
    expect(loadSettings(undefined)).toEqual(DEFAULT_SETTINGS)
    expect(loadSettings(store(null))).toEqual(DEFAULT_SETTINGS)
  })
  it('defaults when storage throws (private mode)', () =>
    expect(loadSettings({ getItem: () => { throw new Error('SecurityError') } })).toEqual(DEFAULT_SETTINGS))
  it('defaults on junk JSON', () => expect(loadSettings(store('{nope'))).toEqual(DEFAULT_SETTINGS))
  it('keeps valid fields and repairs invalid ones', () =>
    expect(loadSettings(store(JSON.stringify({ countMode: 'all', labels: 'yes', rings: false, old: 1 })))).toEqual({ ...DEFAULT_SETTINGS, countMode: 'all', rings: false }))
  it('save swallows storage errors', () =>
    expect(() => saveSettings(DEFAULT_SETTINGS, { setItem: () => { throw new Error('QuotaExceeded') } })).not.toThrow())
  it('a saved Range count mode (no longer offered) falls back to All', () =>
    expect(loadSettings({ getItem: () => JSON.stringify({ countMode: 'range' }) }).countMode).toBe('all'))
  it('reduce motion is off by default (the device setting still applies) and is remembered', () => {
    expect(DEFAULT_SETTINGS.reduceMotion).toBe(false)
    expect(loadSettings(store(JSON.stringify({ reduceMotion: true }))).reduceMotion).toBe(true)
  })
})
