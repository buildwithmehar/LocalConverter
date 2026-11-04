import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';

const api = new WeakMap();
test.beforeEach(async ({ page }) => {
  const requests = [];
  api.set(page, requests);
  await page.route('**/api/**', (route) => {
    requests.push(route.request().url());
    return route.abort();
  });
  await page.route('https://www.googletagmanager.com/**', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: '/* Analytics mocked: no test visits sent. */',
    }),
  );
});
test.afterEach(async ({ page }) => expect(api.get(page)).toEqual([]));
const download = async (page, action = 'Create result') => {
  await page.getByRole('button', { name: action, exact: true }).click();
  await expect(page.locator('.utility-result')).toContainText(/Ready to download|Needs attention/, {
    timeout: 60000,
  });
  await expect(page.locator('.utility-result')).toContainText('Ready to download');
  const [result] = await Promise.all([
    page.waitForEvent('download'),
    page
      .locator('.utility-result')
      .getByRole('link', { name: 'Download result', exact: true })
      .click(),
  ]);
  return fs.readFile(await result.path());
};
test('original header, file picker and tool workspaces render without a server in both themes', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('.header-shell')).toBeVisible();
  await expect(page.getByText('Guide for the installed local app.')).toHaveCount(0);
  await expect(page.locator('input[type="file"]').first()).toBeEnabled();
  await page.goto('/tools');
  await expect(page.getByRole('link', { name: /UUID \/ ULID generator/ })).toBeVisible();
  for (const route of [
    '/generate-id',
    '/resize-image',
    '/merge-pdf',
    '/transcribe-media',
    '/protect-pdf',
    '/raw-converter',
    '/office-render',
  ]) {
    await page.goto(route);
    await expect(page.locator('.utility-workspace')).toBeVisible();
    if (route === '/generate-id')
      await expect(page.locator('.utility-settings button[type="submit"]')).toBeEnabled();
    else await expect(page.getByTestId('utility-file-input')).toBeEnabled();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/tools');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Switch to light mode', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('light');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await fs.mkdir('.artifacts/screenshots', { recursive: true });
  await page.screenshot({
    path: '.artifacts/screenshots/browser-tools-mobile.png',
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test('generator and bounded JSON Schema validation produce actual browser results under production CSP', async ({
  page,
}) => {
  await page.goto('/generate-id');
  await page.getByLabel('Number of IDs', { exact: true }).fill('3');
  const ids = (await download(page)).toString('utf8');
  expect(ids.match(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi)).toHaveLength(3);
  await page.goto('/validate-json-schema');
  await page.getByLabel('Tool input text', { exact: true }).fill('{"name":"Local"}');
  await page
    .getByLabel('JSON Schema', { exact: true })
    .fill('{"type":"object","required":["name"],"properties":{"name":{"type":"string"}}}');
  const report = JSON.parse((await download(page)).toString('utf8'));
  expect(report.valid).toBe(true);
});
test('file converter and PDF workspace download real pixels and document pages without uploads', async ({
  page,
}) => {
  const png = await sharp({ create: { width: 80, height: 60, channels: 4, background: '#cc3344' } })
    .png()
    .toBuffer();
  await page.goto('/png-to-jpg');
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: png });
  await page.getByRole('button', { name: 'Convert', exact: true }).click();
  await expect(page.locator('.file-row')).toContainText('Finished');
  const [image] = await Promise.all([
    page.waitForEvent('download'),
    page
      .getByRole('link', { name: /Download converted|Download photo|Download/ })
      .filter({ hasText: 'Download' })
      .first()
      .click(),
  ]);
  const info = await sharp(await fs.readFile(await image.path())).metadata();
  expect(info.format).toBe('jpeg');
  expect(info.width).toBe(80);
  const one = await PDFDocument.create();
  one.addPage([200, 300]);
  const two = await PDFDocument.create();
  two.addPage([400, 500]);
  await page.goto('/merge-pdf');
  await page.getByTestId('utility-file-input').setInputFiles([
    { name: 'one.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await one.save()) },
    { name: 'two.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await two.save()) },
  ]);
  const result = await PDFDocument.load(await download(page, 'Merge PDFs'));
  expect(result.getPageCount()).toBe(2);
  expect(result.getPage(1).getWidth()).toBe(400);
});
test('Pandoc loads compressed engine and creates a genuine DOCX inside the browser', async ({
  page,
}) => {
  await page.goto('/semantic-document');
  await page
    .getByLabel('Tool input text', { exact: true })
    .fill('# Browser document\n\nThis is the original working website.');
  const bytes = await download(page, 'Process document');
  expect(bytes.subarray(0, 2).toString()).toBe('PK');
});
test('font and RAW workers operate under production CSP with isolated browser memory', async ({
  page,
}) => {
  await page.goto('/convert-font');
  await page
    .getByTestId('utility-file-input')
    .setInputFiles('node_modules/pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf');
  await page.getByLabel('Output container', { exact: true }).selectOption('woff2');
  const font = await download(page, 'Process document');
  expect(font.subarray(0, 4).toString()).toBe('wOF2');
  await page.goto('/raw-converter');
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(true);
  await page.getByTestId('utility-file-input').setInputFiles('tests/fixtures/browser-raw.dng');
  const action = await page.locator('.utility-settings button[type="submit"]').innerText();
  const image = await download(page, action.trim());
  expect((await sharp(image).metadata()).width).toBeGreaterThan(0);
});
test('media, speech and neural image processing use only browser engines under production policy', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/compress-audio');
  await page.getByTestId('utility-file-input').setInputFiles('tests/fixtures/browser-speech.wav');
  const audio = await download(page, 'Compress or trim audio');
  expect(audio.length).toBeGreaterThan(1000);
  await page.goto('/transcribe-media');
  await page.getByTestId('utility-file-input').setInputFiles('tests/fixtures/browser-speech.wav');
  const text = (await download(page, 'Transcribe audio or video locally')).toString('utf8');
  expect(text.toLowerCase()).toContain('fellow americans');
  const png = await sharp({ create: { width: 40, height: 28, channels: 3, background: '#427aca' } })
    .png()
    .toBuffer();
  await page.goto('/ai-upscale');
  await page
    .getByTestId('utility-file-input')
    .setInputFiles({ name: 'source.png', mimeType: 'image/png', buffer: png });
  const image = await download(page, 'Create output');
  const info = await sharp(image).metadata();
  expect(info.width).toBe(80);
  expect(info.height).toBe(56);
  expect(errors).toEqual([]);
});
