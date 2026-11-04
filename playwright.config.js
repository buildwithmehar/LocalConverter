import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  testMatch: ['ui.spec.js', 'roadmap-ui.spec.js'],
  outputDir: '.artifacts/tests/browser',
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: 'http://127.0.0.1:3107',
    channel: 'chrome',
    headless: true,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node server/index.js --test',
    url: 'http://127.0.0.1:3107/api/health',
    env: { PORT: '3107' },
    reuseExistingServer: false,
    timeout: 30000,
  },
  reporter: [['list'], ['html', { open: 'never', outputFolder: '.artifacts/reports/browser' }]],
});
