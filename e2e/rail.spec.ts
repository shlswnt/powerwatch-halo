import { expect, test } from '@playwright/test'

test('the sidebar has the mockup icon rail beside the transformer panel', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the rail is desktop-only; phones get the panel in a sheet')
  await page.goto('/')
  const rail = page.getByRole('navigation', { name: 'Main' })
  await expect(rail.getByRole('img', { name: 'nLine' })).toBeVisible()
  await expect(rail.getByRole('button', { name: 'Map' })).toHaveAttribute('data-active')
  for (const name of ['Instrumentation sites', 'Reports']) {
    const item = rail.getByRole('button', { name })
    await expect(item).toHaveAttribute('aria-disabled', 'true')
    await item.hover()
    await expect(page.locator('[data-slot="tooltip-content"][data-open]')).toContainText(`${name} · Coming soon`)
  }
  // The panel sits to the right of the rail.
  const panel = page.getByRole('heading', { name: 'PowerWatch Halo' })
  expect((await panel.boundingBox())!.x).toBeGreaterThan((await rail.boundingBox())!.x + 50)
  await rail.getByRole('button', { name: 'Settings' }).click()
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible()
})

test('collapsing the sidebar leaves just the icon rail', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop collapse')
  await page.goto('/')
  await page.getByRole('button', { name: 'Toggle Sidebar' }).first().click()
  await expect(page.locator('[data-slot="sidebar"][data-variant="inset"]')).toHaveAttribute('data-state', 'collapsed')
  const rail = page.getByRole('navigation', { name: 'Main' })
  await expect(rail.getByRole('button', { name: 'Map' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'PowerWatch Halo' })).not.toBeInViewport()
  const railBox = (await page.locator('[data-slot="sidebar"]').filter({ has: rail }).last().boundingBox())!
  expect(railBox.width).toBe(65) // the full rail with its line, never squeezed
})

test('in dark mode the sidebar uses the page background, as in the mockup', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop sidebar')
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/')
  const bg = (sel: string) => page.locator(sel).first().evaluate((el) => {
    const ctx = document.createElement('canvas').getContext('2d')!
    ctx.fillStyle = getComputedStyle(el).backgroundColor
    ctx.fillRect(0, 0, 1, 1)
    return Array.from(ctx.getImageData(0, 0, 1, 1).data.slice(0, 3))
  })
  expect(await bg('[data-slot="sidebar-inner"]')).toEqual([10, 10, 10])
  expect(await bg('[data-slot="sidebar-wrapper"]')).toEqual([10, 10, 10])
})

test('on phones the sheet shows the panel with Map and Settings', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phones only')
  await page.goto('/')
  await page.getByRole('button', { name: 'Toggle Sidebar' }).first().click()
  await expect(page.getByRole('heading', { name: 'PowerWatch Halo' })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Transformer list' })).toBeVisible()
  // The same icon rail as on desktop runs down the sheet's left edge, beside the panel.
  const nav = page.getByRole('navigation', { name: 'Main' })
  await expect(nav.getByRole('img', { name: 'nLine' })).toBeVisible()
  await expect.poll(async () => (await nav.boundingBox())!.x).toBe(0) // once the sheet has slid in
  const n = (await nav.boundingBox())!
  const title = (await page.getByRole('heading', { name: 'PowerWatch Halo' }).boundingBox())!
  expect(n.y).toBe(0)
  expect(n.height).toBe(page.viewportSize()!.height)
  expect(title.x).toBeGreaterThan(n.x + n.width)
  const settings = (await nav.getByRole('button', { name: 'Settings' }).boundingBox())!
  expect(settings.y + settings.height).toBeGreaterThan(page.viewportSize()!.height - 70) // at the bottom of the rail
  await expect(page.locator('[data-sidebar="footer"]')).toHaveCount(0)
  await nav.getByRole('button', { name: 'Settings' }).click()
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible()
})

test('the rail starts at the window edge, its icons are centred, and its divider runs the full height', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop rail')
  await page.goto('/')
  const rail = page.locator('[data-slot="sidebar"]').filter({ has: page.getByRole('navigation', { name: 'Main' }) }).last()
  const r = (await rail.boundingBox())!
  const vh = page.viewportSize()!.height
  expect(r.x).toBe(0)
  expect(r.y).toBe(0)
  expect(r.height).toBe(vh)
  expect(r.width).toBe(65) // 64 px rail + 1 px divider, never squeezed by the panel
  for (const name of ['Map', 'Settings']) {
    const b = (await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name }).boundingBox())!
    const left = b.x - r.x
    const right = r.x + r.width - 1 - (b.x + b.width) // minus the 1px border
    expect(Math.abs(left - right)).toBeLessThanOrEqual(1)
  }
})

test('light theme: sidebar and page share the off-white background from the guidelines', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop sidebar')
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/')
  const bg = (sel: string) => page.locator(sel).first().evaluate((el) => {
    const ctx = document.createElement('canvas').getContext('2d')!
    ctx.fillStyle = getComputedStyle(el).backgroundColor
    ctx.fillRect(0, 0, 1, 1)
    return Array.from(ctx.getImageData(0, 0, 1, 1).data.slice(0, 3))
  })
  expect(await bg('[data-slot="sidebar-inner"]')).toEqual([250, 250, 250])
  expect(await bg('[data-slot="sidebar-wrapper"]')).toEqual([250, 250, 250])
  expect(await bg('body')).toEqual([250, 250, 250])
})

test('rail and panel line up: logo with the title, title with the contents, Map with the search row', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop rail')
  await page.goto('/')
  const rail = page.getByRole('navigation', { name: 'Main' })
  const box = async (l: import('@playwright/test').Locator) => (await l.boundingBox())!
  const mid = (b: { y: number; height: number }) => b.y + b.height / 2
  const logo = await box(rail.getByRole('img', { name: 'nLine' }))
  const title = await box(page.getByRole('heading', { name: 'PowerWatch Halo' }))
  const search = await box(page.getByRole('searchbox', { name: 'Search transformers' }))
  const map = await box(rail.getByRole('button', { name: 'Map' }))
  expect(Math.abs(mid(logo) - mid(title))).toBeLessThanOrEqual(1)
  expect(Math.abs(title.x - search.x)).toBeLessThanOrEqual(1)
  expect(Math.abs(mid(map) - mid(search))).toBeLessThanOrEqual(1)
})

const lineX = (el: Element) => { const r = el.getBoundingClientRect(); const w = parseFloat(getComputedStyle(el).borderRightWidth); return w > 0 ? r.right - w : null }

test('open: rail line, panel, right line, then the same 8 px margin the map has from the window top', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop sidebar')
  await page.goto('/')
  const rail = page.locator('[data-slot="sidebar"]').filter({ has: page.getByRole('navigation', { name: 'Main' }) }).last()
  const leftLine = await rail.evaluate(lineX)
  const rightLine = await page.locator('[data-slot="sidebar-inner"]').first().evaluate(lineX)
  expect(leftLine).toBe(64)
  expect(rightLine).not.toBeNull()
  const inset = (await page.locator('[data-slot="sidebar-inset"]').boundingBox())!
  expect(inset.y).toBe(8)
  expect(inset.x - (rightLine! + 1)).toBe(inset.y)
  // The title divider runs from the left line to the right line.
  const h = (await page.locator('[data-slot="sidebar-header"]').filter({ hasText: 'PowerWatch Halo' }).boundingBox())!
  expect(h.x).toBe(leftLine! + 1)
  expect(h.x + h.width).toBe(rightLine)
})

test('closed: the panel slides away leaving one line by the rail, then the same 8 px margin', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop sidebar')
  await page.goto('/')
  await page.locator('[data-sidebar="trigger"]').click()
  await page.waitForTimeout(500)
  const inner = page.locator('[data-slot="sidebar-inner"]').first()
  const line = await inner.evaluate(lineX)
  expect(line).toBe(64) // the right line has landed on the left line
  const inset = (await page.locator('[data-slot="sidebar-inset"]').boundingBox())!
  expect(inset.y).toBe(8)
  expect(inset.x - (line! + 1)).toBe(8)
  const container = (await page.locator('[data-slot="sidebar-container"]').boundingBox())!
  expect(container.x + container.width).toBeLessThanOrEqual(inset.x)
})

test('the panel slides left with the closing edge (its right line moves, it is not just clipped)', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop sidebar')
  await page.goto('/')
  await page.evaluate(() => {
    const h = document.querySelector('h1')!
    const xs: number[] = []
    ;(window as unknown as { xs: number[] }).xs = xs
    const tick = () => { xs.push(h.getBoundingClientRect().x); if (xs.length < 30) requestAnimationFrame(tick) }
    requestAnimationFrame(tick)
  })
  await page.locator('[data-sidebar="trigger"]').click()
  await page.waitForTimeout(700)
  const xs = await page.evaluate(() => (window as unknown as { xs: number[] }).xs)
  expect(Math.min(...xs)).toBeLessThan(xs[0] - 100) // the title travels left with the panel
})

test('the title divider lines up with the bottom of the map buttons; logo, title and toggle share a row', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop sidebar')
  await page.goto('/')
  const header = page.locator('[data-slot="sidebar-header"]').filter({ hasText: 'PowerWatch Halo' })
  const h = (await header.boundingBox())!
  const toggle = (await page.locator('[data-sidebar="trigger"]').boundingBox())!
  const title = (await page.getByRole('heading', { name: 'PowerWatch Halo' }).boundingBox())!
  const logo = (await page.getByRole('navigation', { name: 'Main' }).getByRole('img', { name: 'nLine' }).boundingBox())!
  const mid = (b: { y: number; height: number }) => b.y + b.height / 2
  expect(Math.abs(h.y + h.height - (toggle.y + toggle.height))).toBeLessThanOrEqual(1)
  expect(Math.abs(mid(title) - mid(toggle))).toBeLessThanOrEqual(1)
  expect(Math.abs(mid(logo) - mid(toggle))).toBeLessThanOrEqual(1)
})

test('the location pill is the city picker: its list opens below the city name', async ({ page }) => {
  await page.goto('/')
  const crumb = page.getByTestId('map-breadcrumb')
  await expect(crumb).toContainText('Sierra Leone')
  const trigger = crumb.getByRole('combobox', { name: 'City' })
  await expect(trigger.locator('svg.lucide-chevron-down')).toBeVisible()
  await trigger.click()
  const list = page.getByRole('listbox')
  await expect(list).toBeVisible()
  const t = (await trigger.boundingBox())!
  const pill = (await crumb.boundingBox())!
  const l = (await list.boundingBox())!
  expect(l.y).toBeGreaterThanOrEqual(pill.y + pill.height) // below the pill, not over it
  expect(Math.abs(l.x - t.x)).toBeLessThanOrEqual(16) // lined up under the city name
  await list.getByRole('option', { name: /Kenema/ }).click()
  await expect(page).toHaveURL(/town=kenema/)
  await expect(crumb).toContainText('Kenema')
  await trigger.click()
  await page.getByRole('listbox').getByRole('option', { name: /All cities/ }).click()
  await expect(page).not.toHaveURL(/town=/)
  await expect(page.getByLabel('City', { exact: true })).toHaveCount(1) // the panel no longer has its own City select
})
