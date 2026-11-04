import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkAbort, fail } from './common.js';
export async function renderDiagram(text, options, signal) {
  if (text.length > 30000) fail('Diagrams accept up to 30,000 characters.');
  checkAbort(signal);
  const browser = await chromium.launch({ headless: true });
  const stop = () => void browser.close();
  signal?.addEventListener('abort', stop, { once: true });
  const timer = setTimeout(stop, 20000);
  try {
    const context = await browser.newContext({
      viewport: { width: 1400, height: 1000 },
      serviceWorkers: 'block',
    });
    await context.route('**/*', (route) => route.abort());
    const page = await context.newPage();
    await page.setContent(
      '<!doctype html><html><body style="margin:0;background:white"></body></html>',
    );
    await page.addScriptTag({
      path: fileURLToPath(new URL('../../public/tool-runtime/diagram.js', import.meta.url)),
    });
    const svg = await page.evaluate(
      async ({ text, theme }) => globalThis.renderLocalDiagram(text, theme),
      { text, theme: options.theme },
    );
    checkAbort(signal);
    if (options.format === 'svg') return Buffer.from(svg);
    await page.setContent(svg);
    const box = await page.locator('svg').boundingBox();
    if (!box || box.width * box.height > 40_000_000) fail('Diagram exceeds image limits.');
    return await page.locator('svg').screenshot({ type: 'png', timeout: 15000 });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', stop);
    await browser.close();
  }
}
