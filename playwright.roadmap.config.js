import { defineConfig } from '@playwright/test';
import base from './playwright.config.js';
export default defineConfig({
  ...base,
  testMatch: 'roadmap-ui.spec.js',
  outputDir: '.artifacts/tests/roadmap',
  timeout: 120000,
  reporter: [['list']],
  webServer: { ...base.webServer, reuseExistingServer: false },
});
