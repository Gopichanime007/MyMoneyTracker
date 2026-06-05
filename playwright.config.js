const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 120000,
  expect: {
    timeout: 10000
  },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  use: {
    baseURL: 'http://localhost:4173',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: 'node scripts/serve-static.js',
    port: 4173,
    reuseExistingServer: true,
    timeout: 120000
  },
  projects: [
    {
      name: 'chrome',
      use: { browserName: 'chromium', channel: 'chrome' }
    },
    {
      name: 'edge',
      use: { browserName: 'chromium', channel: 'msedge' }
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'], browserName: 'chromium', channel: 'chrome' }
    }
  ]
});
