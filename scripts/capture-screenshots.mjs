import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

// Documentation captures only: no files, conversion jobs or personal data.
const origin = process.env.SCREENSHOT_ORIGIN || 'https://localconverter.tech';
const output = path.resolve('docs/screenshots');
const views = [
  { name: 'home-dark', route: '/', theme: 'dark' },
  { name: 'home-light', route: '/', theme: 'light' },
  { name: 'tools', route: '/tools', theme: 'dark' },
  { name: 'formats', route: '/formats', theme: 'dark' },
  { name: 'image-compressor', route: '/compress-image', theme: 'dark' },
  { name: 'pdf-merge', route: '/merge-pdf', theme: 'dark' },
  { name: 'mobile-home', route: '/', theme: 'light', mobile: true },
  { name: 'mobile-tools', route: '/tools', theme: 'dark', mobile: true },
];
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--disable-quic'],
});
try {
  for (const view of views) {
    const context = await browser.newContext({
      viewport: view.mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
      deviceScaleFactor: 1,
      reducedMotion: 'reduce',
    });
    await context.addInitScript(
      (theme) => localStorage.setItem('local-converter-theme', theme),
      view.theme,
    );
    await context.route(
      /google-analytics\.com|googletagmanager\.com|cloudflareinsights\.com/,
      (route) => route.abort(),
    );
    const page = await context.newPage();
    const response = await page.goto(new URL(view.route, origin).href, {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });
    if (!response?.ok())
      throw new Error(`Cannot capture ${view.route}: HTTP ${response?.status()}`);
    await page.locator('header.header').waitFor({ state: 'visible' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(output, `${view.name}.png`), animations: 'disabled' });
    console.log(`Captured ${view.name}.png from ${view.route}`);
    await context.close();
  }
} finally {
  await browser.close();
}
