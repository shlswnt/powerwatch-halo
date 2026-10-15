import { expect, test, type Page } from '@playwright/test'

async function openSettings(page: Page, isMobile: boolean) {
  await page.goto('/')
  if (isMobile) await page.getByRole('button', { name: 'Toggle Sidebar' }).first().click()
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Settings' }).click()
  const dialog = page.getByRole('dialog', { name: 'Settings' })
  await expect(dialog).toBeVisible()
  return dialog
}

test('settings are grouped into labelled sections', async ({ page, isMobile }) => {
  const d = await openSettings(page, isMobile)
  for (const name of ['Appearance', 'Counts', 'Map layers', 'About the data']) await expect(d.getByRole('heading', { name })).toBeVisible()
})

test('theme is chosen from three icon cards; picking one applies it', async ({ page, isMobile }) => {
  const d = await openSettings(page, isMobile)
  const theme = d.getByRole('radiogroup', { name: 'Theme' })
  for (const name of ['Light', 'Dark', 'System']) await expect(theme.getByRole('radio', { name }).locator('svg')).toBeVisible()
  await theme.getByRole('radio', { name: 'Dark' }).click()
  await expect(theme.getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true')
  await expect(page.locator('html')).toHaveClass(/dark/)
  await theme.getByRole('radio', { name: 'Light' }).click()
  await expect(page.locator('html')).not.toHaveClass(/dark/)
})

test('counts: a segmented control that explains the chosen mode', async ({ page, isMobile }) => {
  const d = await openSettings(page, isMobile)
  const counts = d.getByRole('radiogroup', { name: 'Counts shown' })
  await counts.getByRole('radio', { name: 'High Confidence' }).click()
  await expect(counts.getByRole('radio', { name: 'High Confidence' })).toHaveAttribute('aria-checked', 'true')
  await expect(d.getByText(/only buildings detected with high confidence/i)).toBeVisible()
  await counts.getByRole('radio', { name: 'All' }).click()
  await expect(d.getByText(/every building footprint/i)).toBeVisible()
  // The three options sit in one row, none cut off.
  for (const name of ['All', 'High Confidence']) {
    const r = counts.getByRole('radio', { name })
    expect(await r.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
  }
})

test('map layers: one card, a row per layer with a description and a switch', async ({ page, isMobile }) => {
  const d = await openSettings(page, isMobile)
  const card = d.getByTestId('map-layers')
  await expect(card).toHaveCSS('border-top-width', '1px')
  for (const name of ['Map labels', 'Building footprints', 'Rings']) {
    const sw = card.getByRole('switch', { name })
    await expect(sw).toBeVisible()
  }
  await expect(card.getByText(/distance rings/i)).toBeVisible()
  const rings = card.getByRole('switch', { name: 'Rings' })
  const before = await rings.getAttribute('aria-checked')
  await rings.click()
  await expect(rings).not.toHaveAttribute('aria-checked', before!)
})

test('about the data reads as labelled facts', async ({ page, isMobile }) => {
  const d = await openSettings(page, isMobile)
  const about = d.getByTestId('about-data')
  await expect(about.getByText('Transformers', { exact: true })).toBeVisible()
  await expect(about.getByText('525', { exact: true })).toBeVisible()
  await expect(about.getByText('Buildings', { exact: true })).toBeVisible()
  await expect(about.getByText('Source', { exact: true })).toBeVisible()
})

test('counts are offered as All or High Confidence — All by default; no Range', async ({ page, isMobile }) => {
  const d = await openSettings(page, isMobile)
  const counts = d.getByRole('radiogroup', { name: 'Counts shown' }).getByRole('radio')
  await expect(counts).toHaveText(['All', 'High Confidence'])
  await expect(counts.first()).toHaveAttribute('aria-checked', 'true')
})

test('the data shows when it was last updated (date and time), and there is no "saved in this browser" line', async ({ page, isMobile }) => {
  const d = await openSettings(page, isMobile)
  const about = d.getByTestId('about-data')
  await expect(about.getByText('Updated', { exact: true })).toBeVisible()
  await expect(about.getByText('Built', { exact: true })).toHaveCount(0)
  await expect(about.getByText('Updated', { exact: true }).locator('xpath=following-sibling::dd[1]')).toHaveText(/\d{1,2}:\d{2}/)
  await expect(d.getByText(/saved in this browser/i)).toHaveCount(0)
})

test('appearance has a Reduce motion switch: on, things stop animating, and it is remembered', async ({ page, isMobile }) => {
  const d = await openSettings(page, isMobile)
  // Under the theme cards, in the Appearance section.
  const sw = d.getByRole('switch', { name: 'Reduce motion' })
  await expect(sw).not.toBeChecked()
  const [theme, swBox, counts] = [(await d.getByRole('radiogroup', { name: 'Theme' }).boundingBox())!, (await sw.boundingBox())!, (await d.getByRole('heading', { name: 'Counts' }).boundingBox())!]
  expect(swBox.y).toBeGreaterThan(theme.y + theme.height)
  expect(swBox.y).toBeLessThan(counts.y)
  await sw.click()
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduce')
  // Animations and transitions are switched off everywhere.
  const still = (sel: string) => page.locator(sel).first().evaluate((el) => {
    const cs = getComputedStyle(el)
    return cs.animationName === 'none' && cs.transitionDuration.split(',').every((x) => parseFloat(x) === 0)
  })
  expect(await still('[data-testid="selection-bar"]')).toBe(true)
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduce')
  if (isMobile) await page.getByRole('button', { name: 'Toggle Sidebar' }).first().click()
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('dialog', { name: 'Settings' }).getByRole('switch', { name: 'Reduce motion' }).click()
  await expect(page.locator('html')).not.toHaveAttribute('data-motion', 'reduce')
  expect(await still('[data-testid="selection-bar"]')).toBe(false)
})
