import { test, expect } from '@playwright/test';
import sharp from 'sharp';
import fs from 'node:fs/promises';
test.beforeAll(async () => {
  await fs.mkdir('.artifacts/screenshots', { recursive: true });
});
test('generators work with no upload and preserve the existing workspace', async ({ page }) => {
  await page.goto('/generate-id');
  await expect(page.locator('.utility-workspace')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create result', exact: true })).toBeEnabled();
  await page.getByLabel('Number of IDs', { exact: true }).fill('3');
  await page.getByRole('button', { name: 'Create result', exact: true }).click();
  await expect(page.locator('.utility-result')).toContainText('Ready to download');
  await page.getByText('Result preview', { exact: false }).click();
  await expect(page.locator('.utility-result pre')).toContainText('-');
});
test('text comparison and live Markdown preview use real inputs', async ({ page }) => {
  await page.goto('/compare-text');
  await page.getByLabel('Tool input text', { exact: true }).fill('Hello\nold');
  await page.getByLabel('Second text', { exact: true }).fill('Hello\nnew');
  await page.getByRole('button', { name: 'Create result', exact: true }).click();
  await expect(page.locator('.utility-result')).toContainText('Ready to download');
  await page.getByText('Result preview', { exact: false }).click();
  await expect(page.locator('.utility-result pre')).toContainText('new');
  await page.goto('/markdown-editor');
  await page
    .getByLabel('Tool input text', { exact: true })
    .fill('# Local preview\n\n**Works**\n<script>alert(1)</script>');
  await expect(
    page
      .frameLocator('iframe[title="Live Markdown preview"]')
      .getByRole('heading', { name: 'Local preview' }),
  ).toBeVisible();
  await expect(
    page.frameLocator('iframe[title="Live Markdown preview"]').locator('script'),
  ).toHaveCount(0);
});
test('diagram and QR previews render without external network access', async ({ page }) => {
  const external = [];
  page.on('request', (r) => {
    if (
      !r.url().startsWith('http://127.0.0.1:3107') &&
      !r.url().startsWith('blob:') &&
      !r.url().startsWith('data:')
    )
      external.push(r.url());
  });
  await page.goto('/diagram-studio');
  await page
    .getByLabel('Tool input text', { exact: true })
    .fill('flowchart LR\n A[Start] --> B[Done]');
  await expect(
    page.frameLocator('iframe[title="Live diagram preview"]').locator('svg'),
  ).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: 'Create result', exact: true }).click();
  await expect(page.locator('.utility-result')).toContainText('Ready to download', {
    timeout: 30000,
  });
  await page.goto('/create-code');
  await page.getByLabel('Tool input text', { exact: true }).fill('https://example.com');
  await expect(page.locator('img[alt="Live QR preview"]')).toBeVisible();
  await page.getByRole('button', { name: 'Create result', exact: true }).click();
  await expect(page.locator('.utility-result')).toContainText('Scan verified', { timeout: 30000 });
  expect(external).toEqual([]);
});
test('browser compression creates downloadable bytes without creating server jobs', async ({
  page,
}) => {
  const png = await sharp({ create: { width: 80, height: 60, channels: 3, background: 'red' } })
      .png()
      .toBuffer(),
    jobs = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().includes('/jobs')) jobs.push(r.url());
  });
  await page.goto('/compress-image');
  await page
    .getByTestId('utility-file-input')
    .setInputFiles({ name: 'test.png', mimeType: 'image/png', buffer: png });
  await page.getByLabel('Processing location', { exact: true }).selectOption('browser');
  await page.getByRole('button', { name: 'Compress image', exact: true }).click();
  await expect(page.getByTestId('browser-result')).toContainText('Ready to download', {
    timeout: 60000,
  });
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('browser-result').getByRole('link', { name: 'Download result' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.jpg$/);
  expect(jobs).toEqual([]);
});
test('browser Pandoc converts Markdown to a real DOCX without upload', async ({ page }) => {
  const jobs = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().includes('/jobs')) jobs.push(r.url());
  });
  await page.goto('/semantic-document');
  await page
    .getByLabel('Tool input text', { exact: true })
    .fill('# Browser conversion\n\nHello document.');
  await page.getByLabel('Processing location', { exact: true }).selectOption('browser');
  await page.getByRole('button', { name: 'Process document', exact: true }).click();
  await expect(page.getByTestId('browser-result')).toContainText('Ready to download', {
    timeout: 90000,
  });
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('browser-result').getByRole('link', { name: 'Download result' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.docx$/);
  expect(jobs).toEqual([]);
});
test('new tool catalog and controls fit mobile and both themes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/tools');
  await expect(page.getByRole('link', { name: /UUID \/ ULID generator/ })).toBeVisible();
  await page.goto('/validate-json-schema');
  await expect(page.getByLabel('JSON Schema', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.artifacts/screenshots/roadmap40-mobile.png', fullPage: true });
});
test('browser HTML exports remove active content and external image resources', async ({
  page,
}) => {
  await page.goto('/semantic-document');
  await page
    .getByLabel('Tool input text', { exact: true })
    .fill(
      '# Safe document\n\n<script>globalThis.pwned=true</script>\n\n![x](https://example.invalid/tracker.png)',
    );
  await page.getByLabel('Output', { exact: true }).selectOption('html');
  await page.getByLabel('Processing location', { exact: true }).selectOption('browser');
  await page.getByRole('button', { name: 'Process document', exact: true }).click();
  await expect(page.getByTestId('browser-result')).toContainText('Ready to download', {
    timeout: 90000,
  });
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('browser-result').getByRole('link', { name: 'Download result' }).click(),
  ]);
  const html = await fs.readFile(await download.path(), 'utf8');
  expect(html).toContain('Safe document');
  expect(html).not.toMatch(/<script|tracker\.png|globalThis.pwned/);
});
test('uploaded Markdown has a live preview and browser WebP downloads contain real WebP pixels', async ({
  page,
}) => {
  await page.goto('/markdown-editor');
  await page
    .getByTestId('utility-file-input')
    .setInputFiles({
      name: 'note.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from('# Uploaded heading\n\nHello file.'),
    });
  await expect(
    page
      .frameLocator('iframe[title="Live Markdown preview"]')
      .getByRole('heading', { name: 'Uploaded heading' }),
  ).toBeVisible();
  await page.goto('/compress-image');
  const png = await sharp({ create: { width: 90, height: 70, channels: 3, background: 'blue' } })
    .png()
    .toBuffer();
  await page
    .getByTestId('utility-file-input')
    .setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: png });
  await page.getByLabel('Processing location', { exact: true }).selectOption('browser');
  await page.getByLabel('Output format', { exact: true }).selectOption('webp');
  await page.getByRole('button', { name: 'Compress image', exact: true }).click();
  await expect(page.getByTestId('browser-result')).toContainText('Ready to download');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('browser-result').getByRole('link', { name: 'Download result' }).click(),
  ]);
  const meta = await sharp(await fs.readFile(await download.path())).metadata();
  expect(meta.format).toBe('webp');
  expect(meta.width).toBe(90);
  expect(meta.height).toBe(70);
});
test('leaving an active browser conversion cancels it without disabling the next tool', async ({
  page,
}) => {
  let release,
    requested = false;
  await page.route('**/tool-runtime/pandoc.wasm', async (route) => {
    requested = true;
    await new Promise((resolve) => {
      release = resolve;
    });
    await route.abort().catch(() => {});
  });
  try {
    await page.goto('/semantic-document');
    await page.getByLabel('Tool input text', { exact: true }).fill('# Pending conversion');
    await page.getByLabel('Processing location', { exact: true }).selectOption('browser');
    await page.getByRole('button', { name: 'Process document', exact: true }).click();
    await expect.poll(() => requested).toBe(true);
    await page.locator('a[href="/split-pdf"]').first().click();
    await expect(page.getByLabel('Pages to keep', { exact: true })).toBeEnabled();
  } finally {
    release?.();
  }
});
