import { expect, test, type Page } from '@playwright/test'

// Masonie + two neighbours in Freetown; they share 1,662 buildings within 500 m.
const OVERLAP_LINK = '/?t=f1e7b9aa,4c3fe28d,6187c113&o=1'

/** Pixels in the map area close to the 500 m ring colour (#38bdf8). Footprints are switched off so only rings can match. */
async function ringPixels(page: Page): Promise<number> {
  const png = (await page.locator('main').screenshot()).toString('base64')
  return page.evaluate(async (data) => {
    const img = new Image()
    img.src = `data:image/png;base64,${data}`
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.width
    c.height = img.height
    const ctx = c.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    const px = ctx.getImageData(0, 0, c.width, c.height).data
    let n = 0
    for (let i = 0; i < px.length; i += 4)
      if (Math.abs(px[i] - 56) < 30 && Math.abs(px[i + 1] - 189) < 30 && Math.abs(px[i + 2] - 248) < 30) n++
    return n
  }, png)
}

test('a shared overlap link draws its rings even when the data arrives after the map', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop is enough to exercise the load order')
  await page.addInitScript(() => localStorage.setItem('pwh-settings', JSON.stringify({ footprints: false })))
  await page.route('**/data/transformers.json', async (route) => {
    await new Promise((r) => setTimeout(r, 2500))
    await route.continue()
  })
  await page.goto(OVERLAP_LINK)
  await expect(page.getByRole('region', { name: 'Overlap' }).getByText('1,662').first()).toBeVisible({ timeout: 15000 })
  await page.waitForTimeout(3000)
  expect(await ringPixels(page)).toBeGreaterThan(300)
})

test('a building file that fails to load offers a Retry in the overlap panel that works', async ({ page }) => {
  let fail = true
  await page.route('**/data/t/4c3fe28d.json', (route) => (fail ? route.fulfill({ status: 500, body: 'nope' }) : route.continue()))
  await page.goto(OVERLAP_LINK)
  const panel = page.getByRole('region', { name: 'Overlap' })
  await expect(panel.getByText("Couldn't load buildings")).toBeVisible({ timeout: 10000 })
  fail = false
  await panel.getByRole('button', { name: 'Retry' }).click()
  await expect(panel.getByText('1,662').first()).toBeVisible()
})

test('on mobile the sidebar and Settings stay reachable while a transformer is open', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile layout only')
  await page.goto('/?t=f1e7b9aa')
  await expect(page.getByRole('region', { name: 'Transformer details' }).getByRole('heading', { name: 'Masonie' })).toBeVisible()
  await page.getByRole('button', { name: 'Toggle Sidebar' }).first().click({ timeout: 5000 })
  await page.getByRole('button', { name: 'Settings' }).click({ timeout: 5000 })
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible()
})

test('on mobile dismissing the sheet keeps an overlap selection', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile layout only')
  await page.goto(OVERLAP_LINK)
  await expect(page.getByRole('region', { name: 'Overlap' }).getByText('1,662').first()).toBeVisible()
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
  expect(page.url()).toContain('t=f1e7b9aa,4c3fe28d,6187c113')
  expect(page.url()).toContain('o=1')
})
