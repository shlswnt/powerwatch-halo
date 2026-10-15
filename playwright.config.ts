import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  webServer: { command: 'npx serve out -l 3100', url: 'http://localhost:3100', reuseExistingServer: true },
  use: { baseURL: 'http://localhost:3100' },
  projects: [
    { name: 'desktop', testIgnore: 'motion.spec.ts', use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', testIgnore: 'motion.spec.ts', use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    // The animation tests time real frames, so they run last and one at a time: with other browsers competing for the
    // CPU, headless Chrome can skip a whole fade in one frame.
    { name: 'motion', testMatch: 'motion.spec.ts', dependencies: ['desktop', 'mobile'], fullyParallel: false,
      use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } } },
  ],
})
