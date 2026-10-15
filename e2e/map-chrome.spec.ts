import { expect, test } from '@playwright/test'


const rgba = (s: string) => (s.match(/[\d.]+/g) ?? []).map(Number)

test('map overlays share one frosted, semi-transparent surface that follows the theme', async ({ page }) => {
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme })
    await page.goto('/')
    const legend = page.getByTestId('band-legend')
    await expect(legend).toBeVisible()
    const style = (el: Element) => ({ bg: getComputedStyle(el).backgroundColor, blur: getComputedStyle(el).backdropFilter })
    const want = await legend.evaluate(style)
    const [r, , , a] = rgba(want.bg)
    expect(a, `${scheme} surface is see-through`).toBeLessThan(0.75)
    expect(want.blur, `${scheme} surface blurs the map`).toMatch(/blur\((1[2-9]|[2-9]\d)px\)/)
    if (scheme === 'light') expect(r).toBeGreaterThan(200)
    else expect(r).toBeLessThan(40)
    const others = [
      page.getByTestId('zoom-pill'),
      page.getByRole('button', { name: 'Fit to selection' }),
      page.getByRole('button', { name: /^Notifications/ }),
      page.getByTestId('map-breadcrumb'),
      page.locator('.maplibregl-ctrl-attrib-button'),
    ]
    for (const o of others) {
      const got = await o.first().evaluate(style)
      expect(got.bg, `${scheme} background`).toBe(want.bg)
      expect(got.blur, `${scheme} blur`).toBe(want.blur)
    }
  }
})

test('the legend is a compact column of band labels, its bottom level with the attribution button', async ({ page }) => {
  await page.goto('/')
  const legend = page.getByTestId('band-legend')
  await expect(legend).toBeVisible()
  await expect(legend).not.toContainText('Radius bands')
  await expect(legend).toContainText('100 m')
  const l = (await legend.boundingBox())!
  const i = (await page.locator('.maplibregl-ctrl-attrib-button').boundingBox())!
  expect(Math.abs(l.y + l.height - (i.y + i.height))).toBeLessThanOrEqual(1)
  // Stacked: each band sits below the one before, all starting at the same x.
  const rows = await Promise.all(['100 m', '200 m', '500 m'].map(async (t) => (await legend.getByText(t, { exact: true }).boundingBox())!))
  expect(rows[1].y).toBeGreaterThan(rows[0].y)
  expect(rows[2].y).toBeGreaterThan(rows[1].y)
  expect(rows[1].x).toBe(rows[0].x)
  expect(l.width).toBeLessThan(100)
})

test('the opened credits box is level with the bottom of the legend', async ({ page }) => {
  await page.goto('/')
  const legend = page.getByTestId('band-legend')
  await expect(legend).toBeVisible()
  const box = page.locator('.maplibregl-ctrl-attrib')
  // MapLibre sets the initial open/closed state once the map loads; keep trying until the box is open.
  await expect(async () => {
    if (!(await box.getAttribute('class'))?.includes('maplibregl-compact-show')) await page.locator('.maplibregl-ctrl-attrib-button').click()
    await expect(box).toHaveClass(/maplibregl-compact-show/, { timeout: 500 })
  }).toPass({ timeout: 10000 })
  const l = (await legend.boundingBox())!
  const b = (await box.boundingBox())!
  expect(Math.abs(b.y + b.height - (l.y + l.height))).toBeLessThanOrEqual(1)
  // Readable: the credits sit on top, even where they overlap the legend on a phone.
  const top = await page.evaluate(([x, y]) => {
    // The legend ignores the pointer, which hit-testing would skip; make it count for this check.
    const legendEl = document.querySelector<HTMLElement>('[data-testid="band-legend"]')!
    legendEl.style.pointerEvents = 'auto'
    const hit = document.elementFromPoint(x, y)
    legendEl.style.pointerEvents = ''
    return !!hit?.closest('.maplibregl-ctrl-attrib')
  }, [b.x + 20, b.y + b.height / 2])
  expect(top).toBe(true)
})

test('the location pill is one row, as tall as the map buttons, with the same border and shadow', async ({ page, isMobile }) => {
  for (const url of ['/', '/?t=f1e7b9aa']) {
    await page.goto(url)
    const crumb = page.getByTestId('map-breadcrumb')
    await expect(crumb).toBeVisible()
    const trigger = page.locator('[data-sidebar="trigger"]')
    const c = (await crumb.boundingBox())!
    const t = (await trigger.boundingBox())!
    expect(Math.abs(c.height - t.height)).toBeLessThanOrEqual(1)
    expect(Math.abs(c.y - t.y)).toBeLessThanOrEqual(1)
    const look = (el: Element) => { const s = getComputedStyle(el); return [s.boxShadow, s.borderRadius, s.borderTopWidth, s.borderTopColor] }
    expect(await crumb.evaluate(look)).toEqual(await trigger.evaluate(look))
  }
  void isMobile
})

test('map buttons sit the same 10 px from the map edges as the legend and the info button', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop layout')
  await page.goto('/')
  await page.locator('[data-sidebar="trigger"]').click() // hide the floating panel so the left controls sit at the map edge
  await page.waitForTimeout(500)
  const map = (await page.locator('[data-slot="sidebar-inset"]').boundingBox())!
  const legend = (await page.getByTestId('band-legend').boundingBox())!
  const toggle = (await page.locator('[data-sidebar="trigger"]').boundingBox())!
  const bell = (await page.getByRole('button', { name: /^Notifications/ }).boundingBox())!
  const m = legend.x - map.x
  expect(m).toBe(10)
  expect(map.y + map.height - (legend.y + legend.height)).toBe(m)
  expect(toggle.x - map.x).toBe(m)
  expect(toggle.y - map.y).toBe(m)
  expect(map.x + map.width - (bell.x + bell.width)).toBe(m)
  expect(bell.y - map.y).toBe(m)
})

test('the location pill shows just the place, with no transformer count or coordinates', async ({ page }) => {
  await page.goto('/?t=f1e7b9aa')
  const crumb = page.getByTestId('map-breadcrumb')
  await expect(crumb).toContainText('Masonie')
  await expect(crumb).not.toContainText(/\d+\.\d{5}/)
  // Only one arrow (the city picker's): the transformer is set off by a plain divider, not a second chevron.
  await expect(crumb).not.toContainText('›')
  await expect(crumb.locator('svg')).toHaveCount(1)
  await expect(crumb.getByRole('separator')).toHaveCount(1)
  await page.goto('/')
  await expect(crumb).toContainText('Sierra Leone')
  await expect(crumb).not.toContainText('transformers')
})
