import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page, isMobile }) => {
  await page.goto('/')
  if (isMobile) await page.getByRole('button', { name: 'Toggle Sidebar' }).first().click()
})

test('each row has a five-colour segment bar scaled to the list maximum', async ({ page }) => {
  const bars = page.getByTestId('segment-bar')
  await expect(bars.first().locator('span')).toHaveCount(5)
  const widths = async (i: number) => bars.nth(i).locator('span').evaluateAll((els) => els.reduce((a, e) => a + parseFloat((e as HTMLElement).style.width), 0))
  expect(await widths(0)).toBeCloseTo(100, 0) // top of the list is the maximum
  expect(await widths(10)).toBeLessThan(100)
})

test('Compare is a small toggle button in the count row that turns on overlap mode in the URL', async ({ page }) => {
  const compare = page.getByRole('button', { name: 'Compare mode' })
  await expect(compare).toHaveAttribute('aria-pressed', 'false')
  expect((await compare.boundingBox())!.height).toBeLessThanOrEqual(28)
  const count = (await page.getByText(/^525 transformers$/).boundingBox())!
  const c = (await compare.boundingBox())!
  expect(Math.abs(c.y + c.height / 2 - (count.y + count.height / 2))).toBeLessThanOrEqual(2) // same row
  await compare.click()
  await expect(compare).toHaveAttribute('aria-pressed', 'true')
  await expect(page).toHaveURL(/o=1/)
  await expect(page.getByRole('switch')).toHaveCount(0)
})

test('Sort is an icon left of the count that opens a menu of sort options', async ({ page }) => {
  await expect(page.getByLabel('Sort', { exact: true }).locator('select')).toHaveCount(0)
  await expect(page.locator('select#tx-sort')).toHaveCount(0)
  const sort = page.getByRole('button', { name: /^Sort/ })
  const countEl = page.getByText(/^525 transformers$/)
  await expect(countEl).toBeInViewport()
  await expect.poll(async () => { // on phones, once the sheet has slid in
    const count = (await countEl.boundingBox())!, s = (await sort.boundingBox())!
    return s.x + s.width <= count.x && Math.abs(s.y + s.height / 2 - (count.y + count.height / 2)) <= 2
  }).toBe(true)
  await sort.click()
  const menu = page.getByRole('menu')
  await expect(menu.getByRole('menuitemradio', { name: 'Most buildings ≤500 m' })).toHaveAttribute('aria-checked', 'true')
  await menu.getByRole('menuitemradio', { name: 'Name A–Z' }).click()
  await expect(menu).toBeHidden()
  const names = await page.getByRole('list', { name: 'Transformer list' }).locator('li .truncate.font-medium').evaluateAll((els) => els.slice(0, 20).map((e) => e.textContent ?? ''))
  expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))
  await sort.click()
  await expect(page.getByRole('menu').getByRole('menuitemradio', { name: 'Name A–Z' })).toHaveAttribute('aria-checked', 'true')
})

test('CSV downloads the listed transformers', async ({ page }) => {
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export counts as CSV' }).click()])
  expect(download.suggestedFilename()).toBe('transformer-reach-all-cities.csv')
  const text = await (await download.createReadStream()).toArray().then((c) => Buffer.concat(c).toString())
  const lines = text.split('\n')
  expect(lines[0]).toMatch(/^id,name,town,lat,lon,kva,b0_100m/)
  expect(lines).toHaveLength(526)
})
