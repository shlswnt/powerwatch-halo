import { expect, test } from '@playwright/test'

test('all text, including counts, is set in Geist with tabular figures', async ({ page }) => {
  await page.goto('/?t=f1e7b9aa')
  const panel = page.getByRole('region', { name: 'Transformer details' })
  const total = panel.getByText('3,115', { exact: true }).first()
  await expect(total).toBeVisible()
  const style = await total.evaluate((el) => ({ family: getComputedStyle(el).fontFamily, numeric: getComputedStyle(el).fontVariantNumeric }))
  expect(style.family).toMatch(/^Geist,/)
  expect(style.numeric).toContain('tabular-nums')
})
