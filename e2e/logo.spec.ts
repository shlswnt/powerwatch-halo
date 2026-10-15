import { expect, test } from '@playwright/test'

test('the rail shows the nLine mark, drawn in the theme colour', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the rail is desktop-only')
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme })
    await page.goto('/')
    const logo = page.getByRole('img', { name: 'nLine' })
    await expect(logo).toBeVisible()
    expect(await logo.locator('path').getAttribute('fill')).toBe('currentColor')
    // Computed colours may be oklch(); paint them on a canvas to read plain RGB.
    const [glyph, tile] = await logo.evaluate((el) => {
      const ctx = document.createElement('canvas').getContext('2d')!
      const red = (c: string) => {
        ctx.clearRect(0, 0, 1, 1)
        ctx.fillStyle = c
        ctx.fillRect(0, 0, 1, 1)
        return ctx.getImageData(0, 0, 1, 1).data[0]
      }
      return [red(getComputedStyle(el).color), red(getComputedStyle(el.parentElement!).backgroundColor)]
    })
    expect(Math.abs(glyph - tile)).toBeGreaterThan(150) // readable on its tile in both themes
    // White tile in light mode, black tile in dark mode.
    const r = tile
    if (scheme === 'light') expect(r, 'light tile').toBeGreaterThan(240)
    else expect(r, 'dark tile').toBeLessThan(30)
  }
})

test('the browser tab icon is the nLine mark', async ({ request }) => {
  const res = await request.get('/icon.svg')
  expect(res.ok()).toBe(true)
  const svg = await res.text()
  expect(svg).toContain('M77.44 210.248')
  expect(svg).toContain('prefers-color-scheme: dark')
})
