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

test('compare follows the ticks: tick two to compare, untick them all to leave; no separate compare switch', async ({ page, isMobile }) => {
  await expect(page.getByRole('button', { name: 'Compare mode' })).toHaveCount(0)
  await expect(page.getByRole('switch')).toHaveCount(0)
  const boxes = page.getByRole('list', { name: 'Transformer list' }).getByRole('checkbox')
  await boxes.nth(0).click()
  await boxes.nth(1).click()
  await expect(page).toHaveURL(/o=1/)
  await expect(boxes.nth(0)).toBeChecked()
  const bar = page.getByRole('button', { name: 'Clear selection' }).locator('..')
  await expect(bar).toContainText('2 selected')
  if (!isMobile) await expect(page.getByRole('region', { name: 'Overlap' }).getByRole('heading', { name: 'Comparing 2 transformers' })).toBeVisible()
  await boxes.nth(0).click()
  await boxes.nth(1).click()
  await expect(page).not.toHaveURL(/o=1/)
  await expect(page).not.toHaveURL(/t=/)
  await expect(boxes.nth(0)).not.toBeChecked()
  await expect(page.getByRole('button', { name: 'Clear selection' })).toHaveCount(0)
})

test('Clear empties the ticks and leaves compare mode', async ({ page }) => {
  const boxes = page.getByRole('list', { name: 'Transformer list' }).getByRole('checkbox')
  await boxes.nth(0).click()
  await boxes.nth(1).click()
  await page.getByRole('button', { name: 'Clear selection' }).click()
  await expect(page).not.toHaveURL(/o=1/)
  await expect(boxes.nth(0)).not.toBeChecked()
})

test('Sort is an icon at the right end of the count row that opens a menu of sort options', async ({ page }) => {
  await expect(page.getByLabel('Sort', { exact: true }).locator('select')).toHaveCount(0)
  await expect(page.locator('select#tx-sort')).toHaveCount(0)
  const sort = page.getByRole('button', { name: /^Sort/ })
  const countEl = page.getByText(/^525 transformers$/)
  await expect(countEl).toBeInViewport()
  const csv = page.getByRole('button', { name: 'Export counts as CSV' })
  const search = page.getByRole('searchbox', { name: 'Search transformers' })
  await expect.poll(async () => { // on phones, once the sheet has slid in
    const [count, sb, c, se] = await Promise.all([countEl, sort, csv, search].map(async (l) => (await l.boundingBox())!))
    return [
      Math.abs(sb.x + sb.width - (c.x + c.width)) <= 0.5, // its hover box ends on the same edge as the CSV button
      sb.x > count.x + count.width, // to the right of the count
      Math.abs(count.x - se.x) <= 0.5, // the count starts on the search box's edge
      Math.abs(sb.y + sb.height / 2 - (count.y + count.height / 2)) <= 2, // same row
    ]
  }).toEqual([true, true, true, true])
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

test('only the transformer rows scroll; search, CSV and the count row stay in view', async ({ page }) => {
  const list = page.getByRole('list', { name: 'Transformer list' })
  const search = page.getByRole('searchbox', { name: 'Search transformers' })
  await expect(list.getByRole('listitem').nth(5)).toBeVisible()
  await expect(search).toBeInViewport()
  const before = (await search.boundingBox())!
  // The list scrolls in its own box (the scroll area's viewport), inside the window.
  const viewport = page.locator('[data-slot="scroll-area-viewport"]').filter({ has: list })
  const box = (await viewport.boundingBox())!
  expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height + 1)
  expect(await viewport.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true)
  await list.hover()
  await page.mouse.wheel(0, 3000)
  await expect.poll(() => viewport.evaluate((el) => el.scrollTop)).toBeGreaterThan(500)
  expect((await search.boundingBox())!.y).toBe(before.y)
  await expect(page.getByRole('button', { name: /^Sort/ })).toBeInViewport()
  await expect(page.getByRole('button', { name: 'Export counts as CSV' })).toBeInViewport()
})

test('adjacent selected rows join into one block: no rounding where they meet, no gap', async ({ page }) => {
  const rows = page.getByRole('list', { name: 'Transformer list' }).getByRole('listitem')
  const boxes = page.getByRole('list', { name: 'Transformer list' }).getByRole('checkbox')
  await boxes.nth(0).click()
  const r = (i: number) => rows.nth(i).evaluate((el) => { const s = getComputedStyle(el); return [s.borderTopLeftRadius, s.borderTopRightRadius, s.borderBottomRightRadius, s.borderBottomLeftRadius] })
  expect((await r(0)).every((v) => v !== '0px')).toBe(true) // a lone selection keeps all four corners
  await boxes.nth(1).click()
  await expect.poll(async () => (await r(0)).slice(2)).toEqual(['0px', '0px'])
  expect((await r(0)).slice(0, 2).every((v) => v !== '0px')).toBe(true)
  expect((await r(1)).slice(0, 2)).toEqual(['0px', '0px'])
  expect((await r(1)).slice(2).every((v) => v !== '0px')).toBe(true)
  const a = (await rows.nth(0).boundingBox())!, b = (await rows.nth(1).boundingBox())!
  expect(Math.abs(b.y - (a.y + a.height))).toBeLessThanOrEqual(0.5)
  // The row after the block is unselected and untouched.
  expect((await r(2)).every((v) => v !== '0px')).toBe(true)
})

test('a full-width line separates the controls from the scrolling list', async ({ page }) => {
  const list = page.locator('[data-slot="scroll-area"]').filter({ has: page.getByRole('list', { name: 'Transformer list' }) })
  await expect(list).toHaveCSS('border-top-width', '1px')
  const sort = (await page.getByRole('button', { name: /^Sort/ }).boundingBox())!
  expect((await list.boundingBox())!.y).toBeGreaterThan(sort.y + sort.height)
  // Edge to edge across the panel, like the divider under the title.
  const header = page.locator('[data-slot="sidebar-header"]').filter({ hasText: 'PowerWatch Halo' })
  await expect.poll(async () => { // on phones, once the sheet has slid in
    const h = (await header.boundingBox())!, b = (await list.boundingBox())!
    return Math.abs(b.x - h.x) <= 1 && Math.abs(b.width - h.width) <= 1
  }).toBe(true)
})

test('shift-clicking a second row compares it with the one you are viewing', async ({ page, isMobile }) => {
  test.skip(isMobile, 'shift-click is a desktop gesture')
  const rows = page.getByRole('list', { name: 'Transformer list' }).getByRole('listitem')
  await rows.nth(0).getByRole('button').click()
  await expect(page).toHaveURL(/t=[^,&]+(&|$)/)
  await rows.nth(1).getByRole('button').click({ modifiers: ['Shift'] })
  await expect(page).toHaveURL(/t=[^,&]+,[^,&]+/)
  await expect(page).toHaveURL(/o=1/)
  await expect(page.getByRole('region', { name: 'Overlap' }).getByRole('heading', { name: 'Comparing 2 transformers' })).toBeVisible()
  const boxes = page.getByRole('list', { name: 'Transformer list' }).getByRole('checkbox')
  await expect(boxes.nth(0)).toBeChecked()
  await expect(boxes.nth(1)).toBeChecked()
  expect(await page.evaluate(() => String(window.getSelection()))).toBe('') // no text gets selected
  // Shift-clicking a ticked row takes it back out.
  await rows.nth(1).getByRole('button').click({ modifiers: ['Shift'] })
  await expect(boxes.nth(1)).not.toBeChecked()
})

test('the selection count is never cut off, even in the narrow phone list', async ({ page }) => {
  const boxes = page.getByRole('list', { name: 'Transformer list' }).getByRole('checkbox')
  await boxes.nth(0).click()
  await boxes.nth(1).click()
  const count = page.getByText('2 selected', { exact: true }).last()
  await expect(count).toBeVisible()
  expect(await count.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
})

test('everything in the panel shares one set of edges: search, selection bar and rows line up, scrollbar or not', async ({ page, isMobile }) => {
  for (const url of ['/', '/?town=bumbuna']) { // a long list (scrolls) and a one-row list (no scrollbar)
    await page.goto(url)
    if (isMobile) await page.getByRole('button', { name: 'Toggle Sidebar' }).first().click()
    const list = page.getByRole('list', { name: 'Transformer list' })
    const row = list.getByRole('listitem').first()
    await row.getByRole('checkbox').click()
    const search = page.getByRole('searchbox', { name: 'Search transformers' })
    const csv = page.getByRole('button', { name: 'Export counts as CSV' })
    const bar = page.getByTestId('selection-bar')
    await expect(bar).toHaveAttribute('aria-hidden', 'false')
    await expect.poll(async () => { // after the sheet (phones) and the bar have finished moving
      const [s, c, b, r] = await Promise.all([search, csv, bar, row].map(async (l) => (await l.boundingBox())!))
      const near = (a: number, z: number) => Math.abs(a - z) <= 0.5
      return near(r.x, s.x) && near(b.x, s.x) && near(r.x + r.width, c.x + c.width) && near(b.x + b.width, c.x + c.width)
    }, { message: `edges line up on ${url}` }).toBe(true)
    // The same 12 px inner inset: the search icon, the bar's text and the row's checkbox all start 12 px in.
    const inset = async (inner: import('@playwright/test').Locator, outer: import('@playwright/test').Locator) =>
      Math.round((await inner.boundingBox())!.x - (await outer.boundingBox())!.x)
    expect(await inset(row.getByRole('checkbox'), row)).toBe(12)
    expect(await inset(bar.getByText(/selected/).first(), bar)).toBe(12)
    expect(await inset(search.locator('xpath=..').locator('svg'), search)).toBe(12)
    // Rows round like the bar and the inputs.
    await expect(row).toHaveCSS('border-top-left-radius', await search.evaluate((el) => getComputedStyle(el).borderTopLeftRadius))
  }
})

test('the list scrollbar overlays the panel padding instead of taking width from the rows', async ({ page }) => {
  const list = page.getByRole('list', { name: 'Transformer list' })
  const row = list.getByRole('listitem').first()
  await expect(row).toBeVisible()
  const before = (await row.boundingBox())!.width
  await list.hover()
  await page.mouse.wheel(0, 400)
  await page.waitForTimeout(300)
  expect(Math.abs((await row.boundingBox())!.width - before)).toBeLessThanOrEqual(0.5)
  const search = (await page.getByRole('searchbox', { name: 'Search transformers' }).boundingBox())!
  const csv = (await page.getByRole('button', { name: 'Export counts as CSV' }).boundingBox())!
  expect(Math.abs(before - (csv.x + csv.width - search.x))).toBeLessThanOrEqual(0.5)
})

test('each row keeps its content inside it: the coloured bar and the count end 12 px in, under the CSV button edge', async ({ page }) => {
  const row = page.getByRole('list', { name: 'Transformer list' }).getByRole('listitem').first()
  await expect(row).toBeVisible()
  const csv = page.getByRole('button', { name: 'Export counts as CSV' })
  await expect.poll(async () => { // after the phone sheet has slid in
    const [r, c, bar] = await Promise.all([row, csv, row.getByTestId('segment-bar')].map(async (l) => (await l.boundingBox())!))
    return [Math.abs(r.x + r.width - (c.x + c.width)) <= 0.5, Math.abs(r.x + r.width - 12 - (bar.x + bar.width)) <= 0.5]
  }).toEqual([true, true])
})

test('list rows are clean: name and count, the town under it, the band bar — no "≤500 m" on every row', async ({ page }) => {
  const list = page.getByRole('list', { name: 'Transformer list' })
  const row = list.getByRole('listitem').first()
  await expect(row).toBeVisible()
  await expect(list.getByText('≤500 m')).toHaveCount(0)
  // What the count means is said once, in the count's own label and tooltip.
  const count = row.getByTestId('row-count')
  await expect(count).toHaveAttribute('title', /^[\d,]+ buildings within 500 m$/)
  await expect(count).toHaveAttribute('aria-label', /^[\d,]+ buildings within 500 m$/)
  // shadcn type scale: 14 px medium name, 12 px muted town, a sans tabular count.
  const name = row.getByTestId('row-name'), town = row.getByTestId('row-town')
  await expect(name).toHaveCSS('font-size', '14px')
  await expect(name).toHaveCSS('font-weight', '500')
  await expect(town).toHaveCSS('font-size', '12px')
  await expect(count).toHaveCSS('font-variant-numeric', 'tabular-nums')
  expect(await count.evaluate((el) => getComputedStyle(el).fontFamily)).not.toMatch(/mono/i)
  // Compact: two text lines and the bar.
  expect((await row.boundingBox())!.height).toBeLessThanOrEqual(64)
})

test('the export button is just the download icon: a square, no "CSV" text, named for screen readers', async ({ page, isMobile }) => {
  await page.goto('/')
  if (isMobile) await page.getByRole('button', { name: 'Toggle Sidebar' }).first().click()
  const btn = page.getByRole('button', { name: 'Export counts as CSV' })
  await expect(btn).toBeVisible()
  await expect(btn).toHaveText('')
  const b = (await btn.boundingBox())!
  expect(Math.abs(b.width - b.height)).toBeLessThanOrEqual(0.5)
  expect(b.height).toBe(44)
})
