import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './packages/ui/tests/browser',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], hasTouch: true },
    },
  ],
  webServer: {
    command:
      'pnpm exec vp dev --config packages/ui/tests/browser/vite.config.ts --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173/packages/ui/tests/browser/',
    reuseExistingServer: !process.env.CI,
  },
});
