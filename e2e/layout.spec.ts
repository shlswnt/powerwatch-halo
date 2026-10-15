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
  await page.getByRole('button', { name: 'Compare mode' }).click()
  const list = page.getByRole('list', { name: 'Transformer list' })
  await list.getByRole('checkbox').nth(0).click()
  await list.getByRole('checkbox').nth(1).click()
  if (isMobile) await page.keyboard.press('Escape') // close the sidebar sheet to reveal the details sheet
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
  await page.waitForTimeout(400)
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
  // The picked transformer is still drawn inside the visible map (left of the details card), not under the sidebar.
  await page.locator('[data-sidebar="trigger"]').click()
  await page.waitForTimeout(400) // let the slide finish
  await page.getByRole('button', { name: 'Fit to selection' }).click()
  await page.waitForTimeout(1500)
  const label = (await page.locator('.maplibregl-marker', { hasText: /^100 m$/ }).boundingBox())!
  const inset = (await page.locator('[data-slot="sidebar-inset"]').boundingBox())!
  const card = (await page.locator('aside[aria-label="Details"]').boundingBox())!
  const mid = (inset.x + card.x) / 2
  expect(Math.abs(label.x + label.width / 2 - mid)).toBeLessThan(4)
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
