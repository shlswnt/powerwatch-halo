import { expect, test, type Page } from '@playwright/test'

type Frame = [t: number, opacity: number]
/** Run `action`, then record `selector`'s opacity every frame for `ms` (-1 while it is absent), with timestamps. */
async function frames(page: Page, selector: string, action: () => Promise<unknown>, ms = 1200): Promise<Frame[]> {
  await page.evaluate(([sel, ms]) => {
    const w = window as unknown as { __f: Frame[] }
    w.__f = []
    const t0 = performance.now()
    const tick = (now: number) => {
      const el = document.querySelector(sel as string)
      w.__f.push([now - t0, el ? Number(getComputedStyle(el).opacity) : -1])
      if (now - t0 < (ms as number)) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [selector, ms] as const)
  await action()
  await page.waitForTimeout(ms + 100)
  return page.evaluate(() => (window as unknown as { __f: Frame[] }).__f)
}
/** Faded in: from its first see-through frame it takes 100 ms+ to become opaque (a snap is never caught see-through, or
    turns opaque within a frame). Headless Chrome draws the map in software, so frames can be far apart: timing works
    where counting in-between frames would not. Starting from the first see-through frame also skips an old element
    that is about to be replaced. */
const fadedIn = (f: Frame[]) => {
  const i = f.findIndex(([, o]) => o >= 0 && o < 0.99)
  if (i < 0) return false
  const j = f.findIndex(([, o], k) => k > i && o >= 0.99)
  return j > 0 && f[j][0] - f[i][0] >= 100
}
/** Faded out: from its first see-through frame it takes 100 ms+ to become invisible (or be removed). */
const fadedOut = (f: Frame[]) => {
  const i = f.findIndex(([, o]) => o > 0.01 && o < 0.99)
  if (i < 0) return false
  const j = f.findIndex(([, o], k) => k > i && o <= 0.01)
  return j > 0 && f[j][0] - f[i][0] >= 100
}
const last = (f: Frame[]) => f.at(-1)![1]

// These time real animations frame by frame, so they run one at a time in their own project, after the rest
// (playwright.config.ts). A retry covers a stray slow frame.
test.describe.configure({ mode: 'serial', retries: 1 })

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await settle(page)
})

/** Wait for the list and the map to finish loading, so the recording window covers the animation, not the load. */
async function settle(page: Page) {
  await expect(page.getByRole('list', { name: 'Transformer list' }).getByRole('checkbox').first()).toBeVisible()
  await page.waitForTimeout(1500)
}

const boxes = (page: Page) => page.getByRole('list', { name: 'Transformer list' }).getByRole('checkbox')

test('the selection bar fades in when a box is ticked and fades out when cleared', async ({ page }) => {
  const bar = '[data-testid="selection-bar"]'
  const inF = await frames(page, bar, () => boxes(page).nth(0).click())
  expect(fadedIn(inF)).toBe(true)
  expect(last(inF)).toBe(1)
  const outF = await frames(page, bar, () => page.getByRole('button', { name: 'Clear selection' }).click())
  expect(fadedOut(outF)).toBe(true)
  expect(last(outF)).toBe(0) // invisible once the exit finishes
})

test('the details contents (not the cards) fade in when you step to the next transformer', async ({ page }) => {
  await page.goto('/?t=f1e7b9aa')
  await expect(page.getByRole('region', { name: 'Transformer details' })).toBeVisible()
  await settle(page)
  const f = await frames(page, '[data-testid="name-switcher"]', () => page.getByRole('button', { name: 'Next transformer' }).click())
  expect(fadedIn(f)).toBe(true)
})

test('ring distance labels fade in when a transformer is picked', async ({ page }) => {
  const f = await frames(page, '[data-testid="ring-label"]', () =>
    page.getByRole('list', { name: 'Transformer list' }).getByRole('listitem').nth(0).getByRole('button').click(), 3500) // after the camera flies in
  expect(fadedIn(f)).toBe(true)
})

test('the transformer name in the location pill fades in', async ({ page }) => {
  const f = await frames(page, '[data-testid="crumb-name"]', () =>
    page.getByRole('list', { name: 'Transformer list' }).getByRole('listitem').nth(0).getByRole('button').click())
  expect(fadedIn(f)).toBe(true)
})

test('the status pill fades in', async ({ page }) => {
  // Fail the buildings only after the transformers have loaded, so the pill appears on its own (not as a text swap
  // while "Loading transformers…" is still showing).
  await page.route('**/goog_msft.pmtiles', async (route) => {
    await new Promise((r) => setTimeout(r, 2500))
    await route.fulfill({ status: 500, body: 'nope' })
  })
  // It shows up while the map is loading, the busiest moment, when sampling frames is unreliable. So catch the moment it
  // turns visible (before any frame is drawn) and check the browser has started a real opacity transition on it.
  await page.addInitScript(() => {
    const w = window as unknown as { __fade: number[] }
    w.__fade = []
    new MutationObserver((records) => {
      for (const r of records) {
        const el = r.target as HTMLElement
        if (el.getAttribute('role') !== 'status' || el.getAttribute('aria-hidden') !== 'false') continue
        for (const a of el.getAnimations()) {
          const t = a as CSSTransition
          if (t.transitionProperty === 'opacity') w.__fade.push(Number(t.effect?.getTiming().duration ?? 0))
        }
      }
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ['aria-hidden'] })
  })
  await page.goto('/?t=f1e7b9aa')
  await expect(page.getByRole('status').filter({ hasText: 'could not load' })).toBeVisible({ timeout: 15000 })
  const fades = await page.evaluate(() => (window as unknown as { __fade: number[] }).__fade)
  expect(fades.length).toBeGreaterThan(0)
  expect(Math.max(...fades)).toBeGreaterThanOrEqual(150)
})

test('with "reduce motion" on, things appear without animating', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await settle(page)
  const f = await frames(page, '[data-testid="selection-bar"]', () => boxes(page).nth(0).click())
  expect(f.some(([, o]) => o > 0.05 && o < 0.95)).toBe(false) // never caught part-way through a fade
  expect(last(f)).toBe(1)
})

test('stepping to the next transformer flies the map there without an initial jump', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/?t=f1e7b9aa')
  await expect(page.getByRole('region', { name: 'Transformer details' })).toBeVisible()
  await settle(page)
  await page.waitForTimeout(1500) // the first flight in has finished
  await page.evaluate(() => {
    const w = window as unknown as { ys: number[][] }
    w.ys = []
    const t0 = performance.now()
    // Ring labels ride on the map. Sample whichever is on screen each frame, noting which element it is.
    const seen: Element[] = []
    const tick = () => {
      const el = document.querySelector('[data-testid="ring-label"]')
      if (el) {
        if (!seen.includes(el)) seen.push(el)
        const r = el.getBoundingClientRect()
        w.ys.push([performance.now() - t0, r.x, r.y, seen.indexOf(el)])
      }
      if (performance.now() - t0 < 1400) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
    ;(document.querySelector('[aria-label="Next transformer"]') as HTMLElement).click()
  })
  await page.waitForTimeout(1600)
  const ys = await page.evaluate(() => (window as unknown as { ys: number[][] }).ys)
  // The new transformer is drawn before the camera sets off (its ring label is there from the first frame, never swapped
  // in mid-flight): that late render used to stall the start of the flight, which then leapt to catch up.
  expect(ys.length).toBeGreaterThan(10)
  expect(ys[0][0]).toBeLessThan(60)
  expect(new Set(ys.map((p) => p[3])).size).toBe(1)
  // And the camera only ever closes in on it: the label's distance to where it lands never grows.
  const [, fx, fy] = ys[ys.length - 1]
  const d = ys.map(([, x, y]) => Math.hypot(x - fx, y - fy))
  expect(d.slice(1).every((v, i) => v <= d[i] + 1)).toBe(true)
})
