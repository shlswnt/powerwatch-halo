import { expect, test, type Page } from '@playwright/test'

// Phones: the details sheet opens at a third of the screen. It can be pulled up, or pulled down to a peek (its header
// still showing, to pull back up) so the map is clear while the selection is kept. Only ✕ puts it away entirely.

const popup = (page: Page) => page.locator('[data-slot="drawer-popup"]')
const handle = (page: Page) => popup(page).locator('[data-slot="drawer-swipe-handle"]')
const vh = (page: Page) => page.viewportSize()!.height

/** The sheet's top edge once it has stopped moving. */
async function top(page: Page) {
  let last = -1
  await expect.poll(async () => {
    const y = (await popup(page).boundingBox())?.y ?? -1
    const still = Math.abs(y - last) < 0.5
    last = y
    return still
  }, { intervals: [150] }).toBe(true)
  return last
}

/** A finger drag on the handle (real touch events, as on a phone). */
async function drag(page: Page, dy: number) {
  const h = (await handle(page).boundingBox())!
  const x = h.x + h.width / 2, y = h.y + h.height / 2
  const cdp = await page.context().newCDPSession(page)
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', ty?: number) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: ty === undefined ? [] : [{ x, y: ty }] })
  await touch('touchStart', y)
  for (let i = 1; i <= 12; i++) {
    await touch('touchMove', y + (dy * i) / 12)
    await page.waitForTimeout(16)
  }
  await touch('touchEnd')
  await cdp.detach()
}

test.beforeEach(({ isMobile }) => test.skip(!isMobile, 'phone sheet'))

test('the details sheet opens at a third of the screen, with a handle to drag', async ({ page }) => {
  await page.goto('/?t=f1e7b9aa')
  await expect(popup(page).getByRole('heading', { name: 'Masonie' })).toBeVisible()
  await expect(handle(page)).toBeVisible()
  expect(Math.abs((await top(page)) - vh(page) * (2 / 3))).toBeLessThanOrEqual(4)
})

test('pulled down, it stops at a peek — header and ✕ still on screen, selection kept — and pulls back up', async ({ page }) => {
  await page.goto('/?t=f1e7b9aa')
  await expect(popup(page).getByRole('heading', { name: 'Masonie' })).toBeVisible()
  await top(page)
  await drag(page, vh(page)) // well past the bottom
  const peek = await top(page)
  expect(peek).toBeGreaterThan(vh(page) - 90) // the map is clear
  expect(peek).toBeLessThan(vh(page) - 40)
  await expect(popup(page).getByRole('button', { name: 'Close details' })).toBeInViewport()
  await expect(page).toHaveURL(/t=f1e7b9aa/) // still selected
  await drag(page, -vh(page) / 3)
  expect(await top(page)).toBeLessThan(vh(page) * 0.75)
})

test('Escape lowers it to the peek instead of closing it', async ({ page }) => {
  await page.goto('/?t=f1e7b9aa')
  await expect(popup(page).getByRole('heading', { name: 'Masonie' })).toBeVisible()
  await top(page)
  await popup(page).getByRole('button', { name: 'Close details' }).focus()
  await page.keyboard.press('Escape')
  expect(await top(page)).toBeGreaterThan(vh(page) - 90)
  await expect(page).toHaveURL(/t=f1e7b9aa/)
})

test('✕ puts it away entirely and clears the selection', async ({ page }) => {
  await page.goto('/?t=f1e7b9aa')
  await popup(page).getByRole('button', { name: 'Close details' }).click()
  await expect(popup(page)).toHaveCount(0)
  await expect(page).not.toHaveURL(/t=/)
})

test('picking from the list while it peeks brings it back up to a third', async ({ page }) => {
  await page.goto('/?t=f1e7b9aa')
  await expect(popup(page).getByRole('heading', { name: 'Masonie' })).toBeVisible()
  await top(page)
  await drag(page, vh(page))
  expect(await top(page)).toBeGreaterThan(vh(page) - 90)
  await page.getByRole('button', { name: 'Toggle Sidebar' }).first().click()
  await page.getByRole('list', { name: 'Transformer list' }).getByRole('listitem').nth(1).getByRole('button').click()
  expect(Math.abs((await top(page)) - vh(page) * (2 / 3))).toBeLessThanOrEqual(4)
})
