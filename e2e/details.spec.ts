import { expect, test } from '@playwright/test'

test('a transformer shows its chips, waterfall chart and band table', async ({ page }) => {
  await page.goto('/?t=f1e7b9aa')
  const panel = page.getByRole('region', { name: 'Transformer details' })
  await expect(panel.getByText('400 kVA')).toBeVisible()
  await expect(panel.getByRole('figure', { name: 'Buildings per band, stacked' })).toBeVisible()
  await expect(panel.getByRole('figure').getByText('Total', { exact: true })).toBeVisible()
  const table = panel.getByRole('table', { name: 'Buildings per band' })
  await expect(table.getByRole('row').nth(1)).toContainText('0–100 m')
  await expect(table.getByRole('row').nth(1)).toContainText('128')
  await expect(table.getByRole('row').nth(5)).toContainText('3,115')
})
