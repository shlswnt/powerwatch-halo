import { expect, test } from '@playwright/test'

const LINK = '/?t=f1e7b9aa,4c3fe28d,6187c113&o=1'

test('three-way overlap: cards and tables, and the radius control', async ({ page }) => {
  await page.goto(LINK)
  const ov = page.getByRole('region', { name: 'Overlap' })
  await expect(ov.getByRole('heading', { name: 'Comparing 3 transformers' })).toBeVisible()
  await expect(ov.getByText('1,662', { exact: true }).first()).toBeVisible()
  await expect(ov.getByText('7,606', { exact: true }).first()).toBeVisible()
  const byT = ov.getByRole('table', { name: 'Overlap by transformer' })
  await expect(byT.getByRole('row').nth(1)).toContainText('3,115')
  await expect(byT.getByRole('row').nth(1)).toContainText('1,562')
  // "Not shared": each transformer's buildings in range of no other selected transformer, explained on hover.
  await expect(byT.getByRole('columnheader', { name: 'Not shared' })).toHaveAttribute('title', /no other selected/)
  await ov.getByRole('button', { name: '300 m' }).click()
  await expect(ov.getByText('Shared within 300 m', { exact: true })).toBeVisible()
  await expect(page).toHaveURL(/r=300/)
})

test('Compare on with one transformer shows the hint, not empty results', async ({ page }) => {
  await page.goto('/?t=f1e7b9aa&o=1')
  const ov = page.getByRole('region', { name: 'Overlap' })
  await expect(ov.getByText('Add one more to compare', { exact: true })).toBeVisible()
  await expect(ov.getByText('Unique buildings covered')).toHaveCount(0)
})

test('clicking a chip\'s name flies the map to that transformer and keeps the comparison; the × still removes it', async ({ page }) => {
  await page.goto(LINK)
  const ov = page.getByRole('region', { name: 'Overlap' })
  await expect(ov.getByRole('heading', { name: 'Comparing 3 transformers' })).toBeVisible()
  await page.waitForTimeout(2500) // the opening fit has finished
  const canvas = page.locator('.maplibregl-canvas')
  const before = await canvas.screenshot()
  const url = page.url()
  await ov.getByRole('button', { name: 'Show Masonie on the map' }).click()
  await page.waitForTimeout(2000)
  expect((await canvas.screenshot()).equals(before)).toBe(false) // the camera moved
  expect(page.url()).toBe(url) // same transformers, still comparing
  await expect(ov.getByRole('heading', { name: 'Comparing 3 transformers' })).toBeVisible()
  await ov.getByRole('button', { name: 'Remove Masonie' }).click()
  await expect(ov.getByRole('heading', { name: 'Comparing 2 transformers' })).toBeVisible()
})

test('the transformer table has a Location column with each transformer\'s coordinates, never squeezed', async ({ page, isMobile }) => {
  const widths = isMobile ? [390] : [1440, 1280, 1000]
  for (const width of widths) {
    if (!isMobile) await page.setViewportSize({ width, height: 900 })
    await page.goto(LINK)
    const byT = page.getByRole('table', { name: 'Overlap by transformer' })
    await expect(byT.getByRole('columnheader', { name: 'Location' })).toBeVisible()
    const row = byT.getByRole('row').nth(1)
    const [name, loc] = [row.getByRole('cell').nth(0), row.getByRole('cell').nth(1)]
    await expect(name).toHaveText('Masonie') // the name cell holds just the name
    await expect(loc).toHaveText(/^-?\d+\.\d{5},?\s*-?\d+\.\d{5}$/)
    // Every cell keeps its text whole (names and coordinates neither cut off nor overlapping the next column).
    const cut = await byT.evaluate((t) => [...t.querySelectorAll('[role="cell"], [role="cell"] > *, [role="columnheader"]')]
      .filter((c) => (c as HTMLElement).scrollWidth > (c as HTMLElement).clientWidth + 1).map((c) => c.textContent))
    expect(cut, `${width}: cut-off cells`).toEqual([])
    const [n, l] = [(await name.boundingBox())!, (await loc.boundingBox())!]
    expect(l.x, `${width}: location right of the name`).toBeGreaterThanOrEqual(n.x + n.width)
  }
})
