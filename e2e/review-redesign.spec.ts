import { expect, test, type Locator } from '@playwright/test'

const LINK = '/?t=f1e7b9aa,4c3fe28d,6187c113&o=1'

test('quick successive ticks are all kept (no lost updates)', async ({ page, isMobile }) => {
  await page.goto('/')
  if (isMobile) await page.getByRole('button', { name: 'Toggle Sidebar' }).first().click()
  const boxes = page.getByRole('list', { name: 'Transformer list' }).getByRole('checkbox')
  await expect(boxes.nth(2)).toBeVisible()
  // Three ticks in one task: nothing re-renders in between, so each must build on the previous one.
  await boxes.first().evaluate(() => {
    const els = document.querySelectorAll<HTMLElement>('[aria-label="Transformer list"] [role="checkbox"]')
    els[0].click()
    els[1].click()
    els[2].click()
  })
  await expect.poll(() => new URL(page.url()).searchParams.get('t')?.split(',').length ?? 0).toBe(3)
})

const overlaps = async (a: Locator, b: Locator) => {
  const [x, y] = [await a.boundingBox(), await b.boundingBox()]
  if (!x || !y) return false
  return x.x < y.x + y.width && y.x < x.x + x.width && x.y < y.y + y.height && y.y < x.y + x.height
}

test('the status pill does not cover the details card', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop layouts')
  for (const width of [1440, 1100]) {
    await page.setViewportSize({ width, height: 900 })
    await page.route('**/goog_msft.pmtiles', (route) => route.fulfill({ status: 500, body: 'nope' }))
    await page.goto(LINK)
    const pill = page.getByRole('status')
    await expect(pill).toContainText('Building footprints could not load', { timeout: 15000 })
    expect(await overlaps(pill, page.locator('aside[aria-label="Details"]'))).toBe(false)
  }
})

test('the selected row is marked for assistive tech and visibly highlighted', async ({ page, isMobile }) => {
  await page.goto('/?town=freetown&t=f1e7b9aa')
  if (isMobile) await page.getByRole('button', { name: 'Toggle Sidebar' }).first().click()
  const row = page.getByRole('list', { name: 'Transformer list' }).getByRole('button', { name: /Masonie/ })
  await expect(row).toHaveAttribute('aria-current', 'true')
  const bg = await row.locator('xpath=..').evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(bg).not.toMatch(/rgba?\(255, 255, 255(, 1)?\)|transparent|rgba\(0, 0, 0, 0\)/)
})

test('no "zoom in to see buildings" hint when a transformer is open at a low zoom', async ({ page }) => {
  await page.goto(LINK)
  await expect(page.getByRole('region', { name: 'Overlap' })).toBeVisible()
  await page.waitForTimeout(2500)
  await expect(page.getByText('Zoom in to see building footprints')).toHaveCount(0)
})
