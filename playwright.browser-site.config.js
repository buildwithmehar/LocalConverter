import { defineConfig } from '@playwright/test';
const liveOrigin = process.env.BROWSER_TEST_ORIGIN;
export default defineConfig({
  testDir: './tests',
  testMatch: 'browser-site-ui.spec.js',
  outputDir: liveOrigin ? '.artifacts/tests/browser-live' : '.artifacts/tests/browser-site',
  workers: 1,
  timeout: 120000,
  use: {
    baseURL: liveOrigin || 'http://127.0.0.1:3116',
    channel: 'chrome',
    headless: true,
    trace: 'retain-on-failure',
    launchOptions: liveOrigin ? { args: ['--disable-quic'] } : undefined,
  },
  webServer: liveOrigin
    ? undefined
    : {
        command: 'node scripts/serve-browser-preview.mjs',
        url: 'http://127.0.0.1:3116/',
        reuseExistingServer: true,
        timeout: 30000,
      },
  reporter: [['list']],
});
