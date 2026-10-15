import { expect, test } from '@playwright/test'

test('the chart carries what the band table did — no table; each bar gives its band, in-band and running totals, and share', async ({ page }) => {
  await page.goto('/?t=f1e7b9aa') // Masonie: 128, 355, 614, 896, 1,122 → 3,115
  const panel = page.getByRole('region', { name: 'Transformer details' })
  await expect(panel.getByText('400 kVA')).toBeVisible()
  const chart = panel.getByRole('figure', { name: 'Buildings per band, stacked' })
  await expect(chart).toBeVisible()
  await expect(panel.getByRole('table')).toHaveCount(0)
  await expect(chart.getByText('Total', { exact: true })).toBeVisible()
  // Each band says its share of the total under its label.
  await expect(chart.getByText('11%', { exact: true })).toBeVisible() // 355 / 3,115
  // Each bar is a labelled control with the full detail (for screen readers too)…
  const bar = chart.getByRole('button', { name: '100–200 m: 355 buildings in this band, 483 within 200 m, 11% of all' })
  await expect(bar).toBeAttached()
  await expect(chart.getByRole('button', { name: /^0–100 m: 128 buildings in this band, 128 within 100 m/ })).toBeAttached()
  await expect(chart.getByRole('button', { name: /^400–500 m: 1,122 buildings in this band, 3,115 within 500 m/ })).toBeAttached()
  // …shown as a tooltip on hover or focus.
  await bar.focus()
  await expect(page.locator('[data-slot="tooltip-content"][data-open]')).toContainText('483 within 200 m')
})

test('desktop pane: chart and field notes side by side (notes wider); only the notes scroll, inside their own box', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the landscape pane is desktop')
  await page.goto('/?t=be5ec996') // long field notes
  const pane = page.locator('aside[aria-label="Details"]')
  await expect(pane).not.toHaveAttribute('inert', '')
  await expect.poll(async () => { // let the pane finish sliding up
    const a = (await pane.boundingBox())!.y
    await page.waitForTimeout(100)
    return (await pane.boundingBox())!.y === a
  }).toBe(true)
  const chart = (await pane.getByTestId('chart-card').boundingBox())!
  const notesBox = pane.getByTestId('field-notes')
  const notes = (await notesBox.boundingBox())!
  expect(notes.x).toBeGreaterThan(chart.x + chart.width) // to the right
  expect(notes.width).toBeGreaterThan(chart.width) // and wider
  expect(Math.abs(notes.y - chart.y)).toBeLessThanOrEqual(0.5)
  const body = pane.getByTestId('details-body-scroll').locator('[data-slot="scroll-area-viewport"]').first()
  expect(await body.evaluate((el) => el.scrollHeight <= el.clientHeight + 1)).toBe(true) // the body itself doesn't scroll
  const text = notesBox.locator('[data-slot="scroll-area-viewport"]')
  expect(await text.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true) // the long notes scroll in their box
  const n = (await notesBox.boundingBox())!, p = (await pane.boundingBox())!
  expect(n.y + n.height).toBeLessThanOrEqual(p.y + p.height - 16) // the box ends inside the pane, above its padding
})

test('desktop pane: a transformer with no notes shows a quiet placeholder in their place', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the landscape pane is desktop')
  await page.goto('/?t=4c3fe28d')
  const pane = page.locator('aside[aria-label="Details"]')
  const notes = pane.getByTestId('field-notes')
  await expect(notes).toBeVisible()
  const text = (await notes.textContent()) ?? ''
  if (/No field notes/.test(text)) await expect(notes).toContainText('No field notes')
})

test('"Compare with nearby" sits in the summary, under the name card and chips, at the bottom of that column', async ({ page, isMobile }) => {
  await page.goto('/?t=980704e9')
  const summary = page.getByTestId('details-summary').filter({ visible: true }).first()
  const btn = summary.getByRole('button', { name: /Compare with \d+ nearby/ })
  await expect(btn).toBeVisible()
  await expect.poll(async () => { // once the sheet (phones) has finished sliding up
    const chips = (await summary.getByText(/kVA/).boundingBox())!, b = (await btn.boundingBox())!
    return b.y > chips.y + chips.height
  }).toBe(true)
  const b = (await btn.boundingBox())!
  if (!isMobile) {
    const s = (await summary.boundingBox())!
    expect(Math.round(s.y + s.height - (b.y + b.height))).toBe(16) // pinned to the column's bottom padding
  }
})

test('desktop overlap pane: two columns that fill it exactly — no explainer text, no pane scroll; with many transformers only their table scrolls', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the landscape pane is desktop')
  const check = async (many: boolean) => {
    const pane = page.locator('aside[aria-label="Details"]')
    const ov = pane.getByRole('region', { name: 'Overlap' })
    const byT = ov.getByRole('table', { name: 'Overlap by transformer' })
    const byR = ov.getByRole('table', { name: 'Overlap by radius' })
    await expect(byT).toBeVisible()
    await expect.poll(async () => { const a = (await pane.boundingBox())!.y; await page.waitForTimeout(100); return (await pane.boundingBox())!.y === a }).toBe(true)
    await expect(ov.getByText(/Adding each transformer/)).toHaveCount(0)
    const body = ov.getByTestId('details-body-scroll').locator('[data-slot="scroll-area-viewport"]').first()
    expect(await body.evaluate((el) => el.scrollHeight <= el.clientHeight + 1)).toBe(true) // the pane doesn't scroll
    const p = (await pane.boundingBox())!, t = (await byT.boundingBox())!, r = (await byR.boundingBox())!
    const stats = (await ov.getByText('Unique buildings covered').locator('xpath=..').boundingBox())!
    // Left column: stats, then the transformer table under them; right column: the radius table.
    expect(t.y).toBeGreaterThan(stats.y + stats.height)
    expect(r.x).toBeGreaterThan(t.x + t.width)
    // Both reach the pane's bottom padding (16 px), level with each other, and start level at the top.
    expect(Math.round(p.y + p.height - 1 - (t.y + t.height))).toBe(16)
    expect(Math.abs(t.y + t.height - (r.y + r.height))).toBeLessThanOrEqual(0.5)
    expect(Math.abs(r.y - stats.y)).toBeLessThanOrEqual(0.5)
    const rows = byT.locator('[data-slot="scroll-area-viewport"]')
    if (many) expect(await rows.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true) // the table scrolls itself
  }
  await page.goto('/?t=f1e7b9aa,4c3fe28d,6187c113&o=1')
  await check(false)
  await page.goto('/?t=db6f5a65') // seven transformers within 500 m
  await page.locator('aside[aria-label="Details"]').getByRole('button', { name: /Compare with 7 nearby/ }).click()
  await expect(page.getByRole('heading', { name: 'Comparing 8 transformers' })).toBeVisible()
  await check(true)
})

test('desktop overlap pane: three transformers fit their table without scrolling (stat labels stay on one line)', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the landscape pane is desktop')
  await page.goto('/?t=f1e7b9aa,4c3fe28d,6187c113&o=1')
  const ov = page.getByRole('region', { name: 'Overlap' })
  const rows = ov.getByRole('table', { name: 'Overlap by transformer' }).locator('[data-slot="scroll-area-viewport"]')
  await expect(rows).toBeVisible()
  await page.waitForTimeout(600)
  expect(await rows.evaluate((el) => el.scrollHeight <= el.clientHeight + 1)).toBe(true)
  const label = ov.getByText('Shared within 500 m', { exact: true })
  expect(await label.evaluate((el) => el.getBoundingClientRect().height)).toBeLessThan(20)
})

test('overlap summary: radius picker above the chips; with many transformers only the chips scroll, heading and radius stay in view', async ({ page }) => {
  await page.goto('/?t=db6f5a65')
  const nearby = page.getByRole('button', { name: /Compare with 7 nearby/ }).filter({ visible: true }).first()
  await nearby.click()
  const ov = page.getByRole('region', { name: 'Overlap' })
  const heading = ov.getByRole('heading', { name: 'Comparing 8 transformers' })
  const radius = ov.getByRole('group', { name: 'Overlap radius' })
  const chips = ov.getByTestId('overlap-chips')
  await expect(heading).toBeVisible()
  await expect.poll(async () => { // once everything has settled
    const r = (await radius.boundingBox())!, c = (await chips.boundingBox())!
    return r.y + r.height < c.y
  }).toBe(true)
  const vp = chips.locator('[data-slot="scroll-area-viewport"]')
  expect(await vp.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true) // eight chips: they scroll
  await expect.poll(async () => { const a = (await heading.boundingBox())!.y; await page.waitForTimeout(100); return (await heading.boundingBox())!.y === a }).toBe(true) // settled
  const [h0, r0] = [(await heading.boundingBox())!.y, (await radius.boundingBox())!.y]
  await vp.evaluate((el) => el.scrollTo(0, el.scrollHeight))
  await page.waitForTimeout(200)
  expect((await heading.boundingBox())!.y).toBe(h0)
  expect((await radius.boundingBox())!.y).toBe(r0)
  await expect(heading).toBeInViewport()
  await expect(radius).toBeInViewport()
})

test('removing transformers until they fit makes the table scrollbar go away', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the landscape pane is desktop')
  await page.goto('/?t=db6f5a65')
  await page.locator('aside[aria-label="Details"]').getByRole('button', { name: /Compare with 7 nearby/ }).click()
  const ov = page.getByRole('region', { name: 'Overlap' })
  await expect(ov.getByRole('heading', { name: 'Comparing 8 transformers' })).toBeVisible()
  const table = ov.getByRole('table', { name: 'Overlap by transformer' })
  const bar = table.locator('[data-slot="scroll-area-scrollbar"]')
  await expect(bar).toBeVisible() // eight rows overflow
  for (let n = 8; n > 2; n--) { // one at a time, each registered before the next
    await ov.getByRole('button', { name: /^Remove / }).first().click()
    await expect(ov.getByRole('heading', { name: `Comparing ${n - 1} transformers` })).toBeVisible()
  }
  await expect(ov.getByRole('heading', { name: 'Comparing 2 transformers' })).toBeVisible()
  await expect(bar).toBeHidden() // two rows fit, so no scrollbar
})

test('the field notes scrollbar sits inside its box, clear of the border and rounded corners', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the landscape pane is desktop')
  await page.goto('/?t=be5ec996')
  const box = page.getByTestId('field-notes')
  const bar = box.locator('[data-slot="scroll-area-scrollbar"]')
  await box.hover()
  await page.mouse.wheel(0, 20)
  await expect(bar).toBeVisible()
  const [b, s, t] = [(await box.boundingBox())!, (await bar.boundingBox())!, (await box.getByText('Field notes', { exact: true }).boundingBox())!]
  expect(s.y).toBeGreaterThanOrEqual(t.y + t.height) // below the title, clear of the top corners
  expect(b.y + b.height - (s.y + s.height)).toBeGreaterThanOrEqual(5)
  expect(b.x + b.width - (s.x + s.width)).toBeGreaterThanOrEqual(4)
})

test('phones: the chart card spans the full width of the sheet, inside its 16 px padding', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone sheet')
  await page.goto('/?t=be5ec996')
  const sheet = page.locator('[data-slot="drawer-popup"]')
  const card = sheet.getByTestId('chart-card')
  await expect(card).toBeVisible()
  await expect.poll(async () => {
    const [s, c] = [(await sheet.boundingBox())!, (await card.boundingBox())!]
    return [Math.round(c.x - s.x), Math.round(s.x + s.width - (c.x + c.width))]
  }).toEqual([16, 16])
  // The field notes below match it.
  const notes = (await sheet.getByTestId('field-notes').boundingBox())!, c = (await card.boundingBox())!
  expect(Math.abs(notes.width - c.width)).toBeLessThanOrEqual(0.5)
})

test('desktop pane: the field notes box holds its own title and lines up with the chart card, top and bottom', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the landscape pane is desktop')
  await page.goto('/?t=be5ec996')
  const pane = page.locator('aside[aria-label="Details"]')
  await expect(pane).not.toHaveAttribute('inert', '')
  await expect.poll(async () => { const a = (await pane.boundingBox())!.y; await page.waitForTimeout(100); return (await pane.boundingBox())!.y === a }).toBe(true)
  const notes = pane.getByTestId('field-notes')
  await expect(notes).toHaveCSS('border-top-width', '1px') // the box itself
  const title = notes.getByText('Field notes', { exact: true })
  const [n, t, c] = await Promise.all([notes, title, pane.getByTestId('chart-card')].map(async (l) => (await l.boundingBox())!))
  expect(t.y).toBeGreaterThan(n.y) // the title is inside the box
  expect(Math.round(t.x - n.x)).toBe(17) // 16 px padding inside the 1 px border, like the chart card
  expect(Math.abs(n.y - c.y)).toBeLessThanOrEqual(0.5)
  expect(Math.abs(n.y + n.height - (c.y + c.height))).toBeLessThanOrEqual(0.5)
  // Only the text scrolls; the title stays put.
  const vp = notes.locator('[data-slot="scroll-area-viewport"]')
  const before = (await title.boundingBox())!.y
  await vp.evaluate((el) => el.scrollTo(0, el.scrollHeight))
  expect((await title.boundingBox())!.y).toBe(before)
})

test('tablet widths use the phone sheet, and its contents stack vertically like on a phone', async ({ page, isMobile }) => {
  test.skip(isMobile, 'sets its own tablet viewport')
  await page.setViewportSize({ width: 700, height: 1000 })
  for (const url of ['/?t=be5ec996', '/?t=f1e7b9aa,4c3fe28d,6187c113&o=1']) {
    await page.goto(url)
    const sheet = page.locator('[data-slot="drawer-popup"]')
    await expect(sheet).toBeVisible()
    await expect.poll(async () => {
      const s = (await sheet.getByTestId('details-summary').boundingBox())!, b = (await sheet.getByTestId('details-body-scroll').boundingBox())!
      return b.y >= s.y + s.height && Math.abs(b.x - s.x) <= 0.5 // below the summary, not beside it
    }).toBe(true)
  }
})

test('the desktop pane adapts to its width without squeezing: stacked and taller when narrow, one data column in between, two when wide', async ({ page, isMobile }) => {
  test.skip(isMobile, 'sets its own desktop widths')
  const cases = [
    { width: 1000, layout: 'stacked' }, // pane ≈ 560 px
    { width: 1200, layout: 'one-column' }, // pane ≈ 760 px
    { width: 1440, layout: 'two-columns' }, // pane ≈ 1000 px
  ] as const
  for (const { width, layout } of cases) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/?t=be5ec996,2d1f5885,bfffd190&o=1')
    const pane = page.locator('aside[aria-label="Details"]')
    const ov = pane.getByRole('region', { name: 'Overlap' })
    const byR = ov.getByRole('table', { name: 'Overlap by radius' })
    await expect(byR).toBeAttached()
    await expect.poll(async () => { const a = (await pane.boundingBox())!.y; await page.waitForTimeout(100); return (await pane.boundingBox())!.y === a }).toBe(true)
    const [s, b] = [(await ov.getByTestId('details-summary').boundingBox())!, (await ov.getByTestId('details-body-scroll').boundingBox())!]
    const stats = (await ov.getByText('Unique buildings covered').locator('xpath=..').boundingBox())!
    const r = (await byR.boundingBox())!
    if (layout === 'stacked') {
      expect(b.y, `${width}: body below summary`).toBeGreaterThanOrEqual(s.y + s.height)
      expect((await pane.boundingBox())!.height, `${width}: taller pane`).toBeGreaterThan(330)
    } else {
      expect(b.x, `${width}: body beside summary`).toBeGreaterThanOrEqual(s.x + s.width)
      if (layout === 'one-column') expect(r.y, `${width}: radius table under the stats`).toBeGreaterThan(stats.y + stats.height)
      else expect(r.x, `${width}: radius table beside the stats`).toBeGreaterThan(stats.x + stats.width)
    }
    // Nothing squeezed: no table cell wraps or truncates, and the stat labels fit.
    const squeezed = await ov.evaluate((root) => [...root.querySelectorAll('[role="cell"], [role="columnheader"]')]
      // A name cell is two lines by design (name, then coordinates): each of its lines must stay on one line.
      .flatMap((c) => (c.children.length ? [...c.children] : [c]))
      .filter((c) => (c as HTMLElement).scrollWidth > (c as HTMLElement).clientWidth + 1 || c.getBoundingClientRect().height > 24)
      .map((c) => c.textContent))
    expect(squeezed, `${width}: squeezed cells`).toEqual([])
    const label = ov.getByText('Unique buildings covered', { exact: true })
    expect(await label.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
  }
})

test('one transformer in compare mode: a clean, centred prompt with the right modifier key for the platform', async ({ browser, isMobile }) => {
  test.skip(isMobile, 'measured in the desktop pane')
  for (const [ua, key] of [
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36', '⌘'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36', 'Ctrl'],
  ] as const) {
    const ctx = await browser.newContext({ userAgent: ua, viewport: { width: 1440, height: 900 } })
    const page = await ctx.newPage()
    await page.goto('/?t=f1e7b9aa&o=1')
    const ov = page.getByRole('region', { name: 'Overlap' })
    const empty = ov.getByTestId('overlap-empty')
    await expect(empty).toBeVisible()
    await expect(empty).toContainText('Add one more to compare')
    await expect(empty).toContainText(`${key}-click`)
    await expect(empty).toContainText('Check another')
    await expect(empty).not.toContainText(/tick|shift-click/i)
    await expect(empty).toHaveCSS('border-top-width', '0px') // no boxed warning
    // Centred in the area beside the summary.
    const [e, body] = [(await empty.boundingBox())!, (await ov.getByTestId('details-body-scroll').boundingBox())!]
    expect(Math.abs(e.x + e.width / 2 - (body.x + body.width / 2))).toBeLessThanOrEqual(2)
    expect(Math.abs(e.y + e.height / 2 - (body.y + body.height / 2))).toBeLessThanOrEqual(12)
    await ctx.close()
  }
})

test('the one-transformer hint never strands a word or two on its last line', async ({ page, isMobile }) => {
  test.skip(isMobile, 'measured in the desktop pane')
  await page.goto('/?t=f1e7b9aa&o=1')
  const hint = page.getByTestId('overlap-empty').getByText(/^Check another/)
  await expect(hint).toBeVisible()
  // Line widths from the text's own boxes: one line, or lines of similar length.
  const widths = await hint.evaluate((el) => {
    const r = document.createRange()
    r.selectNodeContents(el)
    const lines = new Map<number, number>()
    for (const b of r.getClientRects()) lines.set(Math.round(b.top), (lines.get(Math.round(b.top)) ?? 0) + b.width)
    return [...lines.values()]
  })
  expect(Math.min(...widths) / Math.max(...widths)).toBeGreaterThan(0.6)
  // The break falls after "list,": "or …" starts the second line.
  expect(await hint.evaluate((el) => (el as HTMLElement).innerText)).toMatch(/in the list,\nor /)
})

test('the overlap radius highlight slides from the old radius to the new one', async ({ page }) => {
  await page.goto('/?t=f1e7b9aa,be5ec996&o=1&r=100')
  const group = page.getByRole('group', { name: 'Overlap radius' })
  const pill = group.getByTestId('radius-indicator')
  await expect(pill).toBeVisible()
  expect(await pill.evaluate((el) => getComputedStyle(el).transitionProperty)).toMatch(/transform|translate/)
  const at = async (r: number) => {
    const [p, b] = [(await pill.boundingBox())!, (await group.getByRole('button', { name: `${r} m` }).boundingBox())!]
    return Math.abs(p.x - b.x) <= 1 && Math.abs(p.width - b.width) <= 1
  }
  await expect.poll(() => at(100)).toBe(true)
  await group.getByRole('button', { name: '400 m' }).click()
  await expect.poll(() => at(400)).toBe(true)
})

test('stepping with the arrows: the name slides in from the arrow\'s side; the cards stay put and only their contents change', async ({ page }) => {
  await page.goto('/?t=f1e7b9aa')
  const panel = page.getByRole('region', { name: 'Transformer details' })
  await expect(panel.getByRole('heading', { name: 'Masonie' })).toBeVisible()
  // Tag the cards: if they were re-created on a step, the tags would be gone.
  for (const id of ['details-body', 'chart-card', 'field-notes'])
    await page.getByTestId(id).first().evaluate((el) => { (el as HTMLElement).dataset.kept = '1' })
  // Bars glide on the compositor: they move and grow with transforms, never by animating layout (height, bottom).
  const bar = panel.locator('[data-band="1"]')
  const before = await bar.evaluate((el) => getComputedStyle(el).transform)
  const props = await bar.evaluate((el) => getComputedStyle(el).transitionProperty)
  expect(props).toMatch(/transform/)
  expect(props).not.toMatch(/height|bottom|top/)
  expect(await bar.evaluate((el) => getComputedStyle(el).transitionDuration)).not.toBe('0s')

  await panel.getByRole('button', { name: 'Next transformer' }).click()
  await expect(panel.getByRole('heading', { name: 'Masonie' })).toHaveCount(0)
  for (const id of ['details-body', 'chart-card', 'field-notes'])
    await expect(page.getByTestId(id).first()).toHaveAttribute('data-kept', '1')
  await expect(panel.getByTestId('name-switcher')).toHaveAttribute('data-from', 'right')
  await expect.poll(() => bar.evaluate((el) => getComputedStyle(el).transform)).not.toBe(before) // the same bar, new size
  // Content enters with opacity and transform only (no filter), so it stays smooth while the map flies.
  const kf = await panel.getByTestId('name-switcher').evaluate((el) => el.getAnimations().flatMap((a) =>
    ((a as CSSAnimation).effect as KeyframeEffect).getKeyframes().flatMap((k) => Object.keys(k))))
  expect(kf.filter((k) => !['offset', 'easing', 'composite', 'computedOffset', 'opacity', 'transform', 'translate'].includes(k))).toEqual([])

  await panel.getByRole('button', { name: 'Previous transformer' }).click()
  await expect(panel.getByRole('heading', { name: 'Masonie' })).toBeVisible()
  await expect(panel.getByTestId('name-switcher')).toHaveAttribute('data-from', 'left')
  // The cards themselves never animate.
  for (const id of ['chart-card', 'field-notes'])
    expect(await page.getByTestId(id).first().evaluate((el) => getComputedStyle(el).animationName)).toBe('none')
})
