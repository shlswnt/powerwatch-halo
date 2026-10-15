import { expect, test } from '@playwright/test'

const LINK = '/?t=f1e7b9aa,4c3fe28d,6187c113&o=1'

test('three-way overlap: cards and tables, and the radius control', async ({ page }) => {
  await page.goto(LINK)
  const ov = page.getByRole('region', { name: 'Overlap' })
  await expect(ov.getByRole('heading', { name: 'Comparing 3 transformers' })).toBeVisible()
  await expect(ov.getByText('1,662', { exact: true }).first()).toBeVisible()
  await expect(ov.getByText('7,606', { exact: true }).first()).toBeVisible()
  const byT = ov.getByRole('table', { name: 'Overlap by transformer' })
  await expect(byT.getByRole('row').nth(1)).toContainText('3,115')
  await expect(byT.getByRole('row').nth(1)).toContainText('1,562')
  await ov.getByRole('button', { name: '300 m' }).click()
  await expect(ov.getByText('Shared by 2+ within 300 m')).toBeVisible()
  await expect(page).toHaveURL(/r=300/)
})

test('Compare on with one transformer shows the hint, not empty results', async ({ page }) => {
  await page.goto('/?t=f1e7b9aa&o=1')
  const ov = page.getByRole('region', { name: 'Overlap' })
  await expect(ov.getByText(/Select at least 2 transformers/)).toBeVisible()
  await expect(ov.getByText('Unique buildings covered')).toHaveCount(0)
})
