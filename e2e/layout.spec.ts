import { expect, test, type Page } from '@playwright/test'

const openSidebar = async (page: Page, isMobile: boolean) => {
  if (isMobile) await page.getByRole('button', { name: 'Toggle Sidebar' }).first().click()
}
const details = (page: Page) => page.locator('aside[aria-label="Details"]')

test('the inset sidebar holds the transformer list, and the main area is just the map', async ({ page, isMobile }) => {
  await page.goto('/')
  await openSidebar(page, isMobile)
  const sidebar = page.locator('[data-slot="sidebar"]').first()
  await expect(sidebar.getByRole('heading', { name: 'PowerWatch Halo' })).toBeVisible()
  await expect(sidebar.getByRole('button', { name: /^Sort/ })).toBeVisible()
  await expect(sidebar.getByRole('list', { name: 'Transformer list' })).toBeVisible()
  if (!isMobile) {
    await expect(page.locator('[data-slot="sidebar"][data-variant="inset"]')).toHaveCount(1)
    const inset = page.locator('[data-slot="sidebar-inset"]')
    await expect(inset.getByRole('region', { name: 'Map' })).toBeVisible()
    await expect(inset.getByRole('list', { name: 'Transformer list' })).toHaveCount(0)
  }
})

test('the sidebar collapses and expands with the trigger and with Ctrl/Cmd+B', async ({ page, isMobile }) => {
  test.skip(isMobile, 'on phones the sidebar is a sheet')
  await page.goto('/')
  const wrapper = page.locator('[data-slot="sidebar"][data-variant="inset"]')
  await expect(wrapper).toHaveAttribute('data-state', 'expanded')
  await page.getByRole('button', { name: 'Toggle Sidebar' }).first().click()
  await expect(wrapper).toHaveAttribute('data-state', 'collapsed')
  await page.keyboard.press('ControlOrMeta+b')
  await expect(wrapper).toHaveAttribute('data-state', 'expanded')
})

test('details are hidden until a transformer is picked, then show its chart; the close button hides them again', async ({ page, isMobile }) => {
  await page.goto('/')
  if (!isMobile) await expect(details(page)).toHaveAttribute('inert', '')
  await openSidebar(page, isMobile)
  await page.getByRole('searchbox', { name: 'Search transformers' }).fill('Masonie')
  await page.getByRole('list', { name: 'Transformer list' }).getByRole('button', { name: /Masonie/ }).click()
  const panel = page.getByRole('region', { name: 'Transformer details' })
  await expect(panel.getByRole('heading', { name: 'Masonie' })).toBeVisible()
  await expect(panel.getByRole('figure', { name: 'Buildings per band, stacked' })).toBeVisible()
  await page.getByRole('button', { name: 'Close details' }).click()
  await expect(panel).toHaveCount(0)
  await expect(page).not.toHaveURL(/t=/)
})

test('compare mode: two ticked transformers show the overlap in the details panel', async ({ page, isMobile }) => {
  await page.goto('/?town=kenema')
  await openSidebar(page, isMobile)
  const list = page.getByRole('list', { name: 'Transformer list' })
  await list.getByRole('checkbox').nth(0).click()
  await list.getByRole('checkbox').nth(1).click()
  if (isMobile) await page.getByRole('button', { name: 'Close sidebar' }).click() // phones: the overlap is behind the list
  await expect(page.getByRole('region', { name: 'Overlap' }).getByRole('heading', { name: 'Comparing 2 transformers' })).toBeVisible()
})

test('no panel button: the bell sits top-right, level with the sidebar toggle, then a joined zoom pill', async ({ page, isMobile }) => {
  test.skip(isMobile, 'measured on desktop')
  await page.goto('/?t=f1e7b9aa')
  await expect(page.getByRole('button', { name: /panel$/ })).toHaveCount(0)
  const box = async (name: string) => (await page.getByRole('button', { name, exact: true }).boundingBox())!
  await expect(page.getByRole('button', { name: 'Zoom in' })).toBeVisible()
  const toggle = (await page.locator('[data-sidebar="trigger"]').boundingBox())!
  const bell = (await page.getByRole('button', { name: /^Notifications/ }).boundingBox())!
  const zin = await box('Zoom in')
  const zout = await box('Zoom out')
  expect(Math.abs(bell.y - toggle.y)).toBeLessThanOrEqual(1)
  expect(zin.y - (bell.y + bell.height)).toBeGreaterThanOrEqual(20)
  expect(zout.y - (zin.y + zin.height)).toBeLessThanOrEqual(2)
})

test('notifications open to the left of the bell, styled like the details panel', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop popover')
  await page.goto('/?t=f1e7b9aa')
  const bellBtn = page.getByRole('button', { name: /^Notifications/ })
  await bellBtn.click()
  const popup = page.locator('[data-slot="popover-content"]')
  await expect(popup).toContainText('Notifications')
  const p = (await popup.boundingBox())!
  const bell = (await bellBtn.boundingBox())!
  expect(p.x + p.width).toBeLessThanOrEqual(bell.x)
  expect(Math.abs(p.y - bell.y)).toBeLessThanOrEqual(1)
  // Zero-size ring/shadow layers are invisible, so only the visible shadow is compared.
  const look = (el: Element) => { const s = getComputedStyle(el); return [s.backgroundColor, s.borderRadius, s.boxShadow.split(/,(?![^(]*\))/).filter((l) => !l.includes('0px 0px 0px 0px')).join(), s.borderTopColor] }
  expect(await popup.evaluate(look)).toEqual(await details(page).evaluate(look))
})

test('closing details slides the card out in one direction, with no bounce back', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop card')
  await page.goto('/?t=f1e7b9aa')
  await expect(details(page)).not.toHaveAttribute('inert', '')
  // Let the opening slide finish first: x stops changing between two reads 100 ms apart.
  await expect.poll(async () => {
    const a = (await details(page).boundingBox())!.x
    await page.waitForTimeout(100)
    return (await details(page).boundingBox())!.x === a
  }).toBe(true)
  await page.evaluate(() => {
    const el = document.querySelector('aside[aria-label="Details"]')!
    const xs: number[] = []
    ;(window as unknown as { xs: number[] }).xs = xs
    const tick = () => { xs.push(el.getBoundingClientRect().x); if (xs.length < 90) requestAnimationFrame(tick) }
    requestAnimationFrame(tick)
  })
  await page.getByRole('button', { name: 'Close details' }).click()
  await page.waitForTimeout(1200)
  const xs = await page.evaluate(() => (window as unknown as { xs: number[] }).xs)
  for (let i = 1; i < xs.length; i++) expect(xs[i], `frame ${i}`).toBeGreaterThanOrEqual(xs[i - 1] - 0.5)
  await expect(page).not.toHaveURL(/t=/)
})

test('toggling the sidebar never resizes the map canvas, and the view stays framed in the visible area', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop sidebar')
  await page.goto('/?t=f1e7b9aa')
  await expect(page.getByRole('region', { name: 'Transformer details' })).toBeVisible()
  await page.waitForTimeout(1500)
  await page.evaluate(() => {
    const c = document.querySelector('.maplibregl-canvas') as HTMLCanvasElement
    const ws: number[] = []
    ;(window as unknown as { ws: number[] }).ws = ws
    const tick = () => { ws.push(c.width); if (ws.length < 40) requestAnimationFrame(tick) }
    requestAnimationFrame(tick)
  })
  await page.locator('[data-sidebar="trigger"]').click()
  await page.waitForTimeout(800)
  const ws = await page.evaluate(() => (window as unknown as { ws: number[] }).ws)
  expect(new Set(ws).size, `canvas widths ${[...new Set(ws)].join(',')}`).toBe(1)
  // The picked transformer is still drawn inside the visible map: centred across it, and above the details pane.
  await page.locator('[data-sidebar="trigger"]').click()
  await page.waitForTimeout(400) // let the slide finish
  await page.getByRole('button', { name: 'Fit to selection' }).click()
  await page.waitForTimeout(1500)
  const label = (await page.locator('.maplibregl-marker', { hasText: /^100 m$/ }).boundingBox())!
  const inset = (await page.locator('[data-slot="sidebar-inset"]').boundingBox())!
  const card = (await page.locator('aside[aria-label="Details"]').boundingBox())!
  expect(Math.abs(label.x + label.width / 2 - (inset.x + inset.width / 2))).toBeLessThan(4)
  expect(label.y + label.height).toBeLessThan(card.y)
})

test('zoom in and out form one solid joined pill; fit to selection is its own button a little below', async ({ page, isMobile }) => {
  test.skip(isMobile, 'measured on desktop')
  await page.goto('/?t=f1e7b9aa')
  const pill = page.getByTestId('zoom-pill')
  await expect(pill.getByRole('button')).toHaveCount(2)
  await expect(pill.getByRole('button', { name: 'Fit to selection' })).toHaveCount(0)
  // One frosted surface behind both halves, so no map shows through between them.
  await expect(pill).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  for (const name of ['Zoom in', 'Zoom out']) await expect(pill.getByRole('button', { name })).toHaveCSS('border-top-color', /rgba\(0, 0, 0, 0\)|transparent/)
  const box = async (name: string) => (await page.getByRole('button', { name, exact: true }).boundingBox())!
  const zin = await box('Zoom in'), zout = await box('Zoom out'), fit = await box('Fit to selection')
  expect(zout.y - (zin.y + zin.height)).toBeLessThanOrEqual(1) // only the hairline divider between them
  const gap = fit.y - (zout.y + zout.height)
  expect(gap).toBeGreaterThanOrEqual(8)
  expect(gap).toBeLessThanOrEqual(16)
  const p = (await pill.boundingBox())!
  expect([fit.x, fit.width]).toEqual([p.x, p.width]) // same width, lined up
})

test('"Compare with nearby" compares with every transformer within 500 m and says how many', async ({ page }) => {
  // Masonie has no neighbours within 500 m: the button says so and is disabled.
  await page.goto('/?t=f1e7b9aa')
  const details = page.getByRole('region', { name: 'Transformer details' })
  await expect(details.getByRole('button', { name: 'No other transformers within 500 m' })).toBeDisabled()
  await page.goto('/?t=980704e9') // Hospital Road S/S: six within 500 m
  const btn = details.getByRole('button', { name: /Compare with \d+ nearby/ })
  await expect(btn).toBeVisible()
  const n = Number((await btn.textContent())!.match(/\d+/)![0])
  expect(n).toBe(6) // more than the old limit of two
  await btn.click()
  await expect(page).toHaveURL(/o=1/)
  const ids = decodeURIComponent(new URL(page.url()).searchParams.get('t')!).split(',')
  expect(ids).toHaveLength(n + 1)
  expect(ids[0]).toBe('980704e9')
  await expect(page.getByRole('region', { name: 'Overlap' }).getByRole('heading', { name: `Comparing ${n + 1} transformers` })).toBeVisible()
})

test('phones: the details sheet stays open behind the list — checking boxes builds the overlap behind it, the list covers it, closing the list reveals it', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone sheets')
  await page.goto('/?town=kenema')
  const toggle = page.getByRole('button', { name: 'Toggle Sidebar' }).first()
  await toggle.click()
  const list = page.getByRole('list', { name: 'Transformer list' })
  const overlap = page.getByRole('region', { name: 'Overlap' })
  await list.getByRole('checkbox').nth(0).click()
  await list.getByRole('checkbox').nth(1).click()
  await expect(page.getByRole('button', { name: /^Compare \d/ })).toHaveCount(0) // no Compare button any more
  // The overlap sheet is open behind the list, which stays on top and usable.
  await expect(page.locator('[data-slot="drawer-popup"]')).toContainText('Comparing 2 transformers')
  await expect(list.getByRole('checkbox').nth(2)).toBeInViewport()
  const onTop = await list.getByRole('checkbox').nth(2).evaluate((el) => { const r = el.getBoundingClientRect(); return !!document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('[aria-label="Transformer list"]') })
  expect(onTop).toBe(true)
  // Closing the list reveals the overlap.
  await page.getByRole('button', { name: 'Close sidebar' }).click()
  await expect(overlap.getByRole('heading', { name: 'Comparing 2 transformers' })).toBeInViewport()
  // Reopening the list goes over it; the overlap stays, and adding one updates it.
  await toggle.click()
  await expect(list.getByRole('checkbox').nth(0)).toBeChecked()
  await list.getByRole('checkbox').nth(2).click()
  await page.getByRole('button', { name: 'Close sidebar' }).click()
  await expect(overlap.getByRole('heading', { name: 'Comparing 3 transformers' })).toBeInViewport()
})

test('phones: with a transformer open, the list goes over it; tapping another row swaps the details and closes the list', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone sheets')
  await page.goto('/?town=kenema')
  const toggle = page.getByRole('button', { name: 'Toggle Sidebar' }).first()
  await toggle.click()
  const list = page.getByRole('list', { name: 'Transformer list' })
  const rows = list.getByRole('listitem')
  const first = (await rows.nth(0).getByTestId('row-name').textContent())!
  const second = (await rows.nth(1).getByTestId('row-name').textContent())!
  await rows.nth(0).getByRole('button').click()
  const details = page.getByRole('region', { name: 'Transformer details' })
  await expect(details.getByRole('heading', { name: first })).toBeInViewport()
  await expect(list).not.toBeInViewport()
  await toggle.click() // the list goes over the details, which stay open behind (hidden from screen readers meanwhile)
  await expect(list).toBeInViewport()
  await expect(page.locator('[data-slot="drawer-popup"]')).toContainText(first)
  await rows.nth(1).getByRole('button').click()
  await expect(list).not.toBeInViewport()
  await expect(details.getByRole('heading', { name: second })).toBeInViewport()
})

test('a row tap shows that transformer even while comparing; checkboxes build the comparison', async ({ page, isMobile }) => {
  await page.goto('/?town=kenema')
  if (isMobile) await page.getByRole('button', { name: 'Toggle Sidebar' }).first().click()
  const rows = page.getByRole('list', { name: 'Transformer list' }).getByRole('listitem')
  await rows.nth(0).getByRole('checkbox').click()
  await rows.nth(1).getByRole('checkbox').click()
  await expect(page).toHaveURL(/o=1/)
  const name = (await rows.nth(2).getByTestId('row-name').textContent())!
  await rows.nth(2).getByRole('button').click()
  await expect(page).not.toHaveURL(/o=1/)
  await expect(page.getByRole('region', { name: 'Transformer details' }).getByRole('heading', { name })).toBeVisible()
})

const OVERLAP3 = '/?t=f1e7b9aa,4c3fe28d,6187c113&o=1'
const popup = (page: Page) => page.locator('[data-slot="drawer-popup"]')
const detailsScroll = (page: Page) => page.getByRole('region', { name: 'Overlap' }).getByTestId('details-body-scroll').locator('[data-slot="scroll-area-viewport"]').first()

test('phones: tapping the map leaves the overlap sheet open and still (no slide-in replay)', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone sheet')
  await page.goto(OVERLAP3)
  await expect(page.getByRole('region', { name: 'Overlap' })).toBeVisible()
  await page.waitForTimeout(800)
  const y0 = (await popup(page).boundingBox())!.y
  await page.evaluate(() => {
    const el = document.querySelector('[data-slot="drawer-popup"]')!
    const ys: number[] = []
    ;(window as unknown as { ys: number[] }).ys = ys
    const t0 = performance.now()
    const f = () => { ys.push(el.isConnected ? el.getBoundingClientRect().y : -1); if (performance.now() - t0 < 1200) requestAnimationFrame(f) }
    requestAnimationFrame(f)
  })
  await page.touchscreen.tap(200, 250) // the map
  await page.waitForTimeout(1300)
  const ys = await page.evaluate(() => (window as unknown as { ys: number[] }).ys)
  expect(ys.every((y) => Math.abs(y - y0) <= 1)).toBe(true)
  await expect(page.getByRole('region', { name: 'Overlap' })).toBeVisible()
})

test('phones: the details sheet scrolls all the way to the end of the table, at half height too', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone sheet')
  await page.goto(OVERLAP3)
  const ov = page.getByRole('region', { name: 'Overlap' })
  await expect(ov.getByRole('table', { name: 'Overlap by radius' })).toBeVisible()
  const vp = detailsScroll(page)
  await vp.evaluate((el) => el.scrollTo(0, el.scrollHeight))
  await page.waitForTimeout(300)
  const last = ov.getByRole('table').last().getByRole('row').last()
  const b = (await last.boundingBox())!
  expect(b.y + b.height).toBeLessThanOrEqual(page.viewportSize()!.height)
})

test('the details pane uses the same overlay scrollbar as the list (no native scrollbar or its edge line)', async ({ page }) => {
  await page.goto(OVERLAP3)
  await expect(page.getByRole('region', { name: 'Overlap' })).toBeVisible()
  await expect(detailsScroll(page)).toHaveCount(1)
  expect(await detailsScroll(page).evaluate((el) => getComputedStyle(el).scrollbarWidth)).toBe('none')
})

const detailsPane = (page: Page, isMobile: boolean) => (isMobile ? popup(page) : details(page))

test('details header: one clean row — title styled like the panel title, ✕ aligned to the content edge, no stray background', async ({ page, isMobile }) => {
  await page.goto('/?t=f1e7b9aa')
  const pane = detailsPane(page, isMobile)
  const close = pane.getByRole('button', { name: 'Close details' })
  await expect(close).toBeVisible()
  await page.waitForTimeout(600)
  const title = pane.getByTestId('details-title')
  await expect(title).toHaveText('Transformer')
  if (!isMobile) {
    const panelTitle = page.getByRole('heading', { name: 'PowerWatch Halo' })
    for (const prop of ['font-size', 'font-weight']) await expect(title).toHaveCSS(prop, await panelTitle.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop))
  }
  const header = (await pane.getByTestId('details-header').boundingBox())!
  expect(header.height).toBe(48)
  await expect(pane.getByTestId('details-header')).toHaveCSS('border-bottom-width', '1px')
  const icon = (await close.locator('svg').boundingBox())!
  const card = (await pane.getByRole('button', { name: 'Previous transformer' }).locator('xpath=..').boundingBox())!
  const p = (await pane.boundingBox())!
  const border = await pane.evaluate((el) => parseFloat(getComputedStyle(el).borderRightWidth))
  expect(Math.abs(p.x + p.width - border - 16 - (icon.x + icon.width))).toBeLessThanOrEqual(0.5) // the ✕ sits on the 16 px content edge
  expect(await close.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)')
  // The name card starts 16 px under the header line, like the list under the panel title.
  expect(Math.round(card.y - (header.y + header.height))).toBe(16)
})

test('details: the name card and chips stay put; only the content beside or below them scrolls', async ({ page, isMobile }) => {
  await page.goto('/?t=f1e7b9aa')
  const pane = detailsPane(page, isMobile)
  const card = pane.getByRole('button', { name: 'Previous transformer' }).locator('xpath=..')
  await expect(card).toBeVisible()
  await page.waitForTimeout(600)
  const before = (await card.boundingBox())!.y
  const vp = pane.getByTestId('details-body-scroll').locator('[data-slot="scroll-area-viewport"]').first()
  const area = (await pane.getByTestId('details-body-scroll').boundingBox())!
  const summary = (await pane.getByTestId('details-summary').boundingBox())!
  // The scrolling part (and its scrollbar) begins below the pinned summary (phone sheet) or beside it (desktop pane).
  expect(isMobile ? area.y >= summary.y + summary.height : area.x >= summary.x + summary.width).toBe(true)
  await vp.evaluate((el) => el.scrollTo(0, el.scrollHeight))
  await page.waitForTimeout(300)
  // Phones: the chart and notes scroll under the pinned part. Desktop: they fit the pane, so nothing scrolls but notes.
  if (isMobile) expect(await vp.evaluate((el) => el.scrollTop)).toBeGreaterThan(0)
  else expect(await vp.evaluate((el) => el.scrollHeight <= el.clientHeight + 1)).toBe(true)
  expect((await card.boundingBox())!.y).toBe(before)
  await expect(pane.getByRole('button', { name: /Compare with|No other transformers/ })).toBeInViewport()
})

test('overlap: heading, chips and radius picker stay put; the numbers scroll', async ({ page, isMobile }) => {
  await page.goto(OVERLAP3)
  const pane = detailsPane(page, isMobile)
  const radius = pane.getByRole('group', { name: 'Overlap radius' })
  await expect(radius).toBeVisible()
  await page.waitForTimeout(600)
  const before = (await radius.boundingBox())!.y
  const area = (await pane.getByTestId('details-body-scroll').boundingBox())!
  const summary = (await pane.getByTestId('details-summary').boundingBox())!
  expect(isMobile ? area.y >= summary.y + summary.height : area.x >= summary.x + summary.width).toBe(true)
  await pane.getByTestId('details-body-scroll').locator('[data-slot="scroll-area-viewport"]').first().evaluate((el) => el.scrollTo(0, el.scrollHeight))
  await page.waitForTimeout(300)
  expect((await radius.boundingBox())!.y).toBe(before)
})

test('corners nest evenly: everything floating on the map sits 10 px in with a 10 px radius, inside a 20 px map frame', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop frame and card')
  await page.goto('/?t=f1e7b9aa')
  await expect(details(page)).not.toHaveAttribute('inert', '')
  await page.waitForTimeout(500)
  const radius = (l: import('@playwright/test').Locator) => l.evaluate((el) => parseFloat(getComputedStyle(el).borderTopRightRadius))
  const mapEl = page.locator('[data-slot="sidebar-inset"]')
  const map = (await mapEl.boundingBox())!
  const card = (await details(page).boundingBox())!
  expect(card.x - map.x).toBe(10) // a landscape pane 10 px in from the left, right and bottom
  expect(map.x + map.width - (card.x + card.width)).toBe(10)
  expect(map.y + map.height - (card.y + card.height)).toBe(10)
  expect(await radius(details(page))).toBe(10)
  expect(await radius(mapEl)).toBe(20) // outer = inner + gap
  // The map buttons follow the same rule.
  const bell = page.getByRole('button', { name: /^Notifications/ })
  expect(await radius(bell)).toBe(10)
  // Nothing inside the card is rounder than the card itself.
  const inner = await details(page).locator('[class*="rounded-"]').evaluateAll((els) => els.map((el) => parseFloat(getComputedStyle(el).borderTopLeftRadius)).filter((r) => r < 999))
  expect(Math.max(...inner)).toBeLessThanOrEqual(10)
  // Popups that share the card's surface round the same way.
  await bell.click()
  expect(await radius(page.locator('[data-slot="popover-content"]'))).toBe(10)
})

test('copy link: a button beside ✕ copies a link that opens the same view (single or overlap)', async ({ page, context, isMobile, browser }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  for (const [url, region, heading] of [
    ['/?t=f1e7b9aa', 'Transformer details', 'Masonie'],
    [OVERLAP3.replace('&o=1', '&o=1&r=300'), 'Overlap', 'Comparing 3 transformers'],
  ] as const) {
    await page.goto(url)
    const pane = detailsPane(page, isMobile)
    const copy = pane.getByRole('button', { name: 'Copy link' })
    await expect(copy).toBeVisible()
    // Same compact ghost style as ✕, just to its left, in the header row.
    const close = pane.getByRole('button', { name: 'Close details' })
    await expect.poll(async () => { // once the card has slid in
      const [c, x] = [(await copy.boundingBox())!, (await close.boundingBox())!]
      return c.width === x.width && Math.abs(c.y - x.y) <= 0.5 && c.x + c.width < x.x
    }).toBe(true)
    await copy.click()
    await expect(page.getByText('Link copied')).toBeVisible()
    await expect(copy.locator('svg.lucide-check')).toBeVisible() // brief ✓ feedback
    const copied = await page.evaluate(() => navigator.clipboard.readText())
    expect(copied).toBe(page.url())
    // Someone opening it sees the same thing.
    const other = await browser.newPage(isMobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } })
    await other.goto(copied)
    await expect(other.getByRole('region', { name: region }).getByRole('heading', { name: heading })).toBeVisible()
    if (url.includes('r=300')) await expect(other.getByRole('group', { name: 'Overlap radius' }).getByRole('button', { name: '300 m' })).toHaveAttribute('aria-pressed', 'true')
    await other.close()
  }
})

test('desktop: details are a landscape pane along the bottom — summary on the left, the rest beside it, most of the map left clear', async ({ page, isMobile }) => {
  test.skip(isMobile, 'phones keep the bottom sheet')
  for (const url of ['/?t=f1e7b9aa', OVERLAP3]) {
    await page.goto(url)
    const pane = details(page)
    await expect(pane).not.toHaveAttribute('inert', '')
    await page.waitForTimeout(400)
    const p = (await pane.boundingBox())!, map = (await page.locator('[data-slot="sidebar-inset"]').boundingBox())!
    expect(p.width).toBeGreaterThan(p.height * 2)
    expect(p.y - map.y).toBeGreaterThan(map.height * 0.55) // the map above it keeps over half its height
    const summary = (await pane.getByTestId('details-summary').boundingBox())!
    const body = (await pane.getByTestId('details-body-scroll').boundingBox())!
    expect(body.x).toBeGreaterThanOrEqual(summary.x + summary.width)
    expect(Math.abs(body.y - summary.y)).toBeLessThanOrEqual(0.5)
    await expect(pane.getByTestId('details-body-scroll')).toHaveCSS('border-left-width', '1px') // the divider between them
  }
})
