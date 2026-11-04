import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  testMatch: 'public-analytics.spec.js',
  outputDir: '.artifacts/tests/public',
  workers: 1,
  timeout: 30000,
  use: { channel: 'chrome', headless: true, trace: 'retain-on-failure' },
  reporter: [['list']],
});
