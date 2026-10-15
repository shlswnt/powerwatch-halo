import { expect, test } from '@playwright/test'

test('find a transformer in the list and see its five band counts', async ({ page, isMobile }) => {
  await page.goto('/')
  if (isMobile) await page.getByRole('button', { name: 'Toggle Sidebar' }).first().click()
  await page.getByRole('searchbox', { name: 'Search transformers' }).fill('Masonie')
  await page.getByRole('list', { name: 'Transformer list' }).getByRole('button', { name: /Masonie/ }).click()
  const panel = page.getByRole('region', { name: 'Transformer details' })
  await expect(panel.getByRole('heading', { name: 'Masonie' })).toBeVisible()
  // The chart's five bars carry each band's count (they're labelled buttons with the numbers).
  for (const band of ['0–100 m', '100–200 m', '200–300 m', '300–400 m', '400–500 m'])
    await expect(panel.getByRole('button', { name: new RegExp(`^${band}: [\\d,]+ buildings in this band`) })).toBeAttached()
  await expect(page).toHaveURL(/\?t=[0-9a-f]{8}/)
})
