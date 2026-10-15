import { expect, test } from '@playwright/test'


const rgba = (s: string) => (s.match(/[\d.]+/g) ?? []).map(Number)

test('map overlays share one frosted, semi-transparent surface that follows the theme', async ({ page }) => {
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme })
    await page.goto('/')
    const crumb = page.getByTestId('map-breadcrumb')
    await expect(crumb).toBeVisible()
    const style = (el: Element) => ({ bg: getComputedStyle(el).backgroundColor, blur: getComputedStyle(el).backdropFilter })
    const want = await crumb.evaluate(style)
    const [r, , , a] = rgba(want.bg)
    expect(a, `${scheme} surface is see-through`).toBeLessThan(0.75)
    expect(want.blur, `${scheme} surface blurs the map`).toMatch(/blur\((1[2-9]|[2-9]\d)px\)/)
    if (scheme === 'light') expect(r).toBeGreaterThan(200)
    else expect(r).toBeLessThan(40)
    const others = [
      page.getByTestId('zoom-pill'),
      page.getByRole('button', { name: 'Fit to selection' }),
      page.getByRole('button', { name: /^Notifications/ }),
      page.locator('.maplibregl-ctrl-attrib-button'),
    ]
    for (const o of others) {
      const got = await o.first().evaluate(style)
      expect(got.bg, `${scheme} background`).toBe(want.bg)
      expect(got.blur, `${scheme} blur`).toBe(want.blur)
    }
  }
})

test('no band legend: the rings of a selected transformer are labelled with their distances instead', async ({ page }) => {
  await page.goto('/?t=f1e7b9aa')
  await expect(page.getByRole('region', { name: 'Transformer details' }).or(page.getByRole('dialog')).first()).toBeAttached()
  // The labels appear once the camera has flown in, which can take a while on a busy machine.
  for (const d of [100, 200, 300, 400, 500]) await expect(page.locator('.maplibregl-marker', { hasText: new RegExp(`^${d} m$`) })).toHaveCount(1, { timeout: 15000 })
  await expect(page.getByTestId('band-legend')).toHaveCount(0)
  await page.goto('/')
  await expect(page.getByTestId('map-breadcrumb')).toBeVisible()
  await expect(page.getByTestId('band-legend')).toHaveCount(0)
})

test('the opened credits box sits 10 px from the bottom of the map, the (i) button at its right end', async ({ page }) => {
  await page.goto('/')
  const box = page.locator('.maplibregl-ctrl-attrib')
  // MapLibre sets the initial open/closed state once the map loads; keep trying until the box is open.
  await expect(async () => {
    if (!(await box.getAttribute('class'))?.includes('maplibregl-compact-show')) await page.locator('.maplibregl-ctrl-attrib-button').click()
    await expect(box).toHaveClass(/maplibregl-compact-show/, { timeout: 500 })
  }).toPass({ timeout: 10000 })
  const map = (await page.locator('[data-slot="sidebar-inset"]').boundingBox())!
  const b = (await box.boundingBox())!
  const i = (await page.locator('.maplibregl-ctrl-attrib-button').boundingBox())!
  expect(Math.abs(map.y + map.height - (b.y + b.height) - 10)).toBeLessThanOrEqual(1)
  expect(Math.abs(b.y + b.height - (i.y + i.height))).toBeLessThanOrEqual(1)
  expect(b.height).toBeLessThanOrEqual(34) // one line of credits
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

test('map buttons sit the same 10 px from the map edges as the info button', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop layout')
  await page.goto('/')
  await page.locator('[data-sidebar="trigger"]').click() // hide the floating panel so the left controls sit at the map edge
  await page.waitForTimeout(500)
  const map = (await page.locator('[data-slot="sidebar-inset"]').boundingBox())!
  const info = (await page.locator('.maplibregl-ctrl-attrib-button').boundingBox())!
  const toggle = (await page.locator('[data-sidebar="trigger"]').boundingBox())!
  const bell = (await page.getByRole('button', { name: /^Notifications/ }).boundingBox())!
  const m = 10
  expect(Math.abs(map.y + map.height - (info.y + info.height) - m)).toBeLessThanOrEqual(1)
  expect(Math.abs(map.x + map.width - (info.x + info.width) - m)).toBeLessThanOrEqual(1)
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

test('clicking the credits (i) button leaves no focus glow; keyboard focus still shows a ring', async ({ page }) => {
  await page.goto('/')
  const btn = page.locator('.maplibregl-ctrl-attrib-button')
  await expect(btn).toBeVisible()
  await btn.click()
  await btn.click()
  await expect(btn).toBeFocused()
  await expect(btn).toHaveCSS('box-shadow', 'none')
  // Keyboard users still see where focus is.
  await btn.evaluate((el) => (el as HTMLElement).blur())
  await btn.focus()
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Tab')
  const shadow = await page.evaluate(() => document.activeElement?.matches('.maplibregl-ctrl-attrib-button') ? getComputedStyle(document.activeElement).boxShadow : 'not focused')
  expect(shadow).not.toBe('none')
  expect(shadow).not.toContain('rgb(0, 150, 255)') // MapLibre's default blue
})

test('every control on the map has the same outline: bell, zoom pill, fit button and the city pill', async ({ page }) => {
  await page.goto('/')
  const look = (el: Element) => {
    const s = getComputedStyle(el)
    return [s.borderTopWidth, s.borderTopColor, s.backgroundClip, s.backgroundColor, s.boxShadow, s.backdropFilter, s.borderTopRightRadius]
  }
  const want = await page.getByRole('button', { name: /^Notifications/ }).evaluate(look)
  for (const l of [page.getByTestId('zoom-pill'), page.getByRole('button', { name: 'Fit to selection' }), page.getByTestId('map-breadcrumb')])
    expect(await l.evaluate(look)).toEqual(want)
})

test('map controls have the same outline in both themes: a hairline over their own surface, light on dark, dark on light', async ({ page }) => {
  const alpha = (c: string) => Number(c.match(/[\d.]+(?=\))/)?.[0] ?? (c.startsWith('rgba') ? NaN : 1))
  const seen: number[] = []
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme })
    await page.goto('/')
    for (const l of [page.getByRole('button', { name: /^Notifications/ }), page.getByTestId('zoom-pill'), page.getByTestId('map-breadcrumb')]) {
      const [clip, border] = await l.evaluate((el) => { const s = getComputedStyle(el); return [s.backgroundClip, s.borderTopColor] })
      expect(clip, `${scheme}: drawn over the surface, not the map`).toBe('border-box')
      const [r] = border.match(/\d+/g)!.map(Number)
      expect(scheme === 'dark' ? r : 255 - r, `${scheme}: the opposite tone`).toBeGreaterThan(200)
      seen.push(alpha(border))
    }
  }
  expect(new Set(seen).size).toBe(1) // the same strength in both themes
  expect(seen[0]).toBeGreaterThanOrEqual(0.12)
})

test('the (i) credits button rises with exactly the same timing as the details pane slides up', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the pane only pushes controls on desktop')
  await page.goto('/')
  const timing = (sel: string) => page.locator(sel).first().evaluate((el) => { const s = getComputedStyle(el); return [s.transitionDuration, s.transitionTimingFunction] })
  expect(await timing('.maplibregl-ctrl-bottom-right')).toEqual(await timing('aside[aria-label="Details"]'))
  // And it ends up 10 px above the open pane, like the other map controls keep 10 px from things.
  await page.goto('/?t=f1e7b9aa')
  const pane = page.locator('aside[aria-label="Details"]')
  await expect(pane).not.toHaveAttribute('inert', '')
  await expect.poll(async () => {
    const i = (await page.locator('.maplibregl-ctrl-attrib-button').boundingBox())!, p = (await pane.boundingBox())!
    return Math.round(p.y - (i.y + i.height))
  }).toBe(10)
})

test('the (i) button stays exactly in place when the credits open and close, and they slide out from it', async ({ page }) => {
  await page.goto('/')
  const btn = page.locator('.maplibregl-ctrl-attrib-button')
  await expect(btn).toBeVisible()
  await page.waitForTimeout(800)
  const at = async () => { const b = (await btn.boundingBox())!; return [b.x, b.y, b.width, b.height] }
  const first = await at()
  // Click, and in the same task see what animation the browser starts on the credits box.
  const started = await page.evaluate(() => {
    const button = document.querySelector('.maplibregl-ctrl-attrib-button') as HTMLElement
    const box = document.querySelector('.maplibregl-ctrl-attrib') as HTMLElement
    const wasOpen = box.classList.contains('maplibregl-compact-show')
    button.click()
    const opened = !wasOpen
    return { opened, anims: box.getAnimations().map((a) => [(a as CSSAnimation).animationName, Number(a.effect?.getTiming().duration ?? 0)] as [string, number]) }
  })
  await page.waitForTimeout(500)
  expect(await at()).toEqual(first) // not a pixel of movement
  if (!started.opened) {
    // It started open; this click closed it, so open it again to see the slide.
    const again = await page.evaluate(() => {
      ;(document.querySelector('.maplibregl-ctrl-attrib-button') as HTMLElement).click()
      return (document.querySelector('.maplibregl-ctrl-attrib') as HTMLElement).getAnimations().map((a) => [(a as CSSAnimation).animationName, Number(a.effect?.getTiming().duration ?? 0)] as [string, number])
    })
    started.anims = again
    await page.waitForTimeout(500)
    expect(await at()).toEqual(first)
  }
  expect(started.anims.some(([name, d]) => name === 'attrib-slide-out' && d >= 150)).toBe(true)
})

test('closing the credits slides them back into the (i) circle before they disappear', async ({ page }) => {
  await page.goto('/')
  const btn = page.locator('.maplibregl-ctrl-attrib-button')
  const box = page.locator('.maplibregl-ctrl-attrib')
  await expect(btn).toBeVisible()
  await page.waitForTimeout(800)
  if (!(await box.getAttribute('class'))?.includes('maplibregl-compact-show')) { await btn.click(); await page.waitForTimeout(500) }
  await expect(box).toHaveClass(/maplibregl-compact-show/)
  const before = (await btn.boundingBox())!
  const during = await page.evaluate(() => {
    const b = document.querySelector('.maplibregl-ctrl-attrib') as HTMLElement
    ;(document.querySelector('.maplibregl-ctrl-attrib-button') as HTMLElement).click()
    return { stillShown: b.classList.contains('maplibregl-compact-show'), anims: b.getAnimations().map((a) => [(a as CSSAnimation).animationName, Number(a.effect?.getTiming().duration ?? 0)] as [string, number]) }
  })
  expect(during.stillShown).toBe(true) // still visible while it slides in
  expect(during.anims.some(([n, d]) => n === 'attrib-slide-in' && d >= 150)).toBe(true)
  await expect(box).not.toHaveClass(/maplibregl-compact-show/, { timeout: 2000 }) // then it closes
  expect(await btn.boundingBox()).toEqual(before) // the circle never moves
  await btn.click() // and it still opens again normally
  await expect(box).toHaveClass(/maplibregl-compact-show/)
})

test('the credits always close on click, even if the closing animation never runs', async ({ page }) => {
  await page.goto('/')
  await page.addStyleTag({ content: '.maplibregl-ctrl-attrib.attrib-closing { animation: none !important; }' })
  const btn = page.locator('.maplibregl-ctrl-attrib-button')
  const box = page.locator('.maplibregl-ctrl-attrib')
  await expect(btn).toBeVisible()
  await page.waitForTimeout(800)
  if (!(await box.getAttribute('class'))?.includes('maplibregl-compact-show')) await btn.click()
  await expect(box).toHaveClass(/maplibregl-compact-show/)
  await btn.click()
  await expect(box).not.toHaveClass(/maplibregl-compact-show/, { timeout: 2000 })
  await btn.click()
  await expect(box).toHaveClass(/maplibregl-compact-show/)
})

test('the map credits start with "Maps " before the Mapbox copyright', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.maplibregl-ctrl-attrib-inner')).toContainText('Maps © Mapbox')
})
