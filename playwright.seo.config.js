import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  outputDir: '.artifacts/tests/seo',
  testMatch: 'seo-ui.spec.js',
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: 'http://127.0.0.1:3111',
    channel: 'chrome',
    headless: true,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node server/index.js --test',
    url: 'http://127.0.0.1:3111/api/health',
    env: { PORT: '3111' },
    reuseExistingServer: false,
    timeout: 30000,
  },
  reporter: [['list']],
});
