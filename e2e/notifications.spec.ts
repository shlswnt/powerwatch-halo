import { expect, test } from '@playwright/test'

test('problems loading a link show up under the bell', async ({ page }) => {
  await page.goto('/?t=deadbeef')
  const bell = page.getByRole('button', { name: 'Notifications, 1 unread' })
  await expect(bell).toBeVisible()
  await bell.click()
  await expect(page.getByText("1 transformer in this link wasn't found.").last()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Notifications, 0 unread' })).toBeVisible()
})
