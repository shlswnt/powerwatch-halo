import { expect, test } from '@playwright/test'

test('while a details card is open the credits stay collapsed, so they never cover the legend', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop cards')
  await page.goto('/?t=f1e7b9aa')
  await expect(page.getByRole('region', { name: 'Transformer details' })).toBeVisible()
  await page.waitForTimeout(2000)
  const attrib = page.locator('.maplibregl-ctrl-attrib')
  await expect(attrib).not.toHaveClass(/maplibregl-compact-show/)
  const legend = (await page.getByTestId('band-legend').boundingBox())!
  const a = (await attrib.boundingBox())!
  expect(a.x).toBeGreaterThanOrEqual(legend.x + legend.width)
  // The (i) button still opens them on request.
  await page.locator('.maplibregl-ctrl-attrib-button').click()
  await expect(attrib).toHaveClass(/maplibregl-compact-show/)
})
