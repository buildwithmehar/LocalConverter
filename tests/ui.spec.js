import { test, expect } from '@playwright/test';
import sharp from 'sharp';
import { readFile, mkdir } from 'node:fs/promises';
import { unzipSync } from 'fflate';
import { PDFDocument } from 'pdf-lib';
const shots = '.artifacts/screenshots';
test.beforeAll(async () => {
  await mkdir(shots, { recursive: true });
});

test('navigation remains opaque without page flashes, click ripples or theme wipes', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => localStorage.setItem('local-converter-theme', 'light'));
  await page.goto('/formats');
  await expect(page.locator('.format-library')).toBeVisible();
  await page.evaluate(() => {
    window.routeFrames = [];
    const sample = () => {
      const view = document.querySelector('.ui-page-view');
      if (view) {
        const css = getComputedStyle(view);
        window.routeFrames.push({ opacity: Number(css.opacity), filter: css.filter });
      }
    };
    window.flashObserver = new MutationObserver(sample);
    window.flashObserver.observe(document.getElementById('main'), {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style'],
    });
    sample();
  });
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Help', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Your first conversion', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Loading the conversion guide…', { exact: true })).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      window.routeFrames.every((frame) => frame.opacity === 1 && frame.filter === 'none'),
    ),
  ).toBe(true);
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Formats', exact: true })
    .click();
  await page.getByRole('searchbox', { name: 'Find a format' }).fill('mp3');
  await expect(page.locator('.format-conversion-link').first()).toBeVisible();
  await page
    .getByRole('group', { name: 'Format categories' })
    .getByRole('button', { name: /Images/ })
    .click();
  await expect(page.locator('.animate-rippling')).toHaveCount(0);
  await page.getByRole('button', { name: 'Switch to dark mode', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(
    await page.evaluate(() =>
      document
        .getAnimations()
        .some((animation) => animation.effect?.pseudoElement?.includes('view-transition')),
    ),
  ).toBe(false);
  await page.getByRole('link', { name: 'Local Converter home', exact: true }).click();
  const select = page.getByRole('button', { name: 'Select File', exact: true });
  await select.hover();
  await expect(page.locator('.animate-shimmer-slide,.animate-spin-around')).toHaveCount(0);
  expect(
    await page
      .locator('.ui-surface')
      .evaluateAll((cards) => cards.every((card) => card.dataset.effects === 'static')),
  ).toBe(true);
});

test('lightweight controls retain real actions and respect reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  const select = page.getByRole('button', { name: 'Select File', exact: true });
  await expect(select).toBeEnabled();
  await expect(select).toHaveAttribute('data-feedback', 'subtle');
  await select.hover();
  await expect(select.locator('.animate-shimmer-slide')).toHaveCount(0);
  const chooserPromise = page.waitForEvent('filechooser');
  await select.click();
  await (await chooserPromise).setFiles([]);
  const card = page.locator('.upload-card');
  const dropzone = page.getByLabel('File drop zone', { exact: true });
  await dropzone.dispatchEvent('dragenter');
  await expect(card.locator('.ui-effect-beam>div')).toHaveCount(1);
  await dropzone.dispatchEvent('dragleave');
  await expect(card.locator('.ui-effect-beam>div')).toHaveCount(0);
  await page.getByRole('button', { name: 'Switch to light mode', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('html')).not.toHaveAttribute('data-magicui-theme-vt', 'active');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(select).toHaveCSS('transition-duration', '0s');
  await dropzone.dispatchEvent('dragenter');
  await expect(card.locator('.ui-effect-beam>div')).toHaveCount(0);
  await dropzone.dispatchEvent('dragleave');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('home upload opens its dedicated converter and navigation preserves separate workspaces', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Select File', exact: true })).toBeEnabled();
  const png = await sharp({ create: { width: 18, height: 12, channels: 3, background: '#b93634' } })
    .png()
    .toBuffer();
  const webp = await sharp(png).webp().toBuffer();
  await page
    .getByTestId('file-input')
    .setInputFiles({ name: 'first.png', mimeType: 'image/png', buffer: png });
  await expect(page).toHaveURL(/\/png-to-jpg$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('PNG to JPG Converter');
  await page.getByRole('link', { name: 'Local Converter home', exact: true }).click();
  await expect(
    page.getByRole('link', { name: 'Continue your conversions', exact: true }),
  ).toBeVisible();
  await page.locator('.popular-grid a[href="/webp-to-png"]').click();
  await page
    .getByTestId('file-input')
    .setInputFiles({ name: 'second.webp', mimeType: 'image/webp', buffer: webp });
  await expect(page).toHaveURL(/\/webp-to-png$/);
  await expect(page.getByText('second.webp', { exact: true })).toBeVisible();
  await expect(page.getByText('first.png', { exact: true })).toHaveCount(0);
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: /My files/ })
    .click();
  await expect(page).toHaveURL(/\/activity$/);
  await expect(page.getByText('first.png', { exact: true })).toBeVisible();
  await expect(page.getByText('second.webp', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'PNG to JPG converter', exact: true }).click();
  await page.getByRole('button', { name: 'Clear all', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'About PNG and JPG', exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByText('first.png', { exact: true })).toHaveCount(0);
  await expect(page.getByText('second.webp', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Convert', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Download second.png', exact: true })).toBeVisible({
    timeout: 20000,
  });
});

test('mixed files open the activity page and changing a file output opens the correct converter', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Select File', exact: true })).toBeEnabled();
  const png = await sharp({ create: { width: 12, height: 10, channels: 3, background: '#cc3322' } })
    .png()
    .toBuffer();
  await page.getByTestId('file-input').setInputFiles([
    { name: 'image.png', mimeType: 'image/png', buffer: png },
    { name: 'table.csv', mimeType: 'text/csv', buffer: Buffer.from('name,value\nA,1\n') },
  ]);
  await expect(page).toHaveURL(/\/activity$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your conversions');
  await page.getByRole('link', { name: 'PNG to JPG converter', exact: true }).click();
  await page.getByRole('button', { name: 'Output format for image.png: JPG', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'WEBP', exact: true }).click();
  await expect(page).toHaveURL(/\/png-to-webp$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('PNG to WEBP Converter');
  await page.getByRole('button', { name: 'Convert', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Download image.webp', exact: true })).toBeVisible({
    timeout: 20000,
  });
  await expect(page.getByRole('link', { name: 'Download all', exact: true })).toHaveAttribute(
    'href',
    '/api/download-all?source=png&target=webp',
  );
});

test('floating header shrinks on scroll, stays available and expands again', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1000 });
  await page.goto('/');
  const header = page.locator('.header-shell');
  await expect(header).toHaveCSS('position', 'fixed');
  await expect(header).toHaveCSS('max-width', '1280px');
  const heading = page.getByRole('heading', { name: 'Local File Converter', exact: true });
  await expect(heading).toHaveAttribute('data-motion-enter', 'settled');
  const initialHeadingY = (await heading.boundingBox()).y;
  await page.evaluate(() => window.scrollTo(0, 360));
  await expect(header).toHaveAttribute('data-scrolled', 'true');
  await expect(header).toHaveCSS('max-width', '1120px');
  expect((await header.boundingBox()).y).toBe(12);
  expect(await heading.evaluate((e) => Math.round(e.getBoundingClientRect().y + scrollY))).toBe(
    Math.round(initialHeadingY),
  );
  await page.getByRole('button', { name: 'Tools', exact: true }).click();
  await expect(page.getByRole('link', { name: 'All local tools', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(header).toHaveAttribute('data-scrolled', 'false');
  await expect(header).toHaveCSS('max-width', '1280px');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(header).toHaveCSS('transition-duration', '0s');
  await page.evaluate(() => window.scrollTo(0, 360));
  await expect(header).toHaveAttribute('data-scrolled', 'true');
  await expect(header).toHaveCSS('max-width', '1120px');
  await page.setViewportSize({ width: 320, height: 740 });
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await header.boundingBox()).y).toBe(8);
});

test('minimal header keeps a single conversion action and accessible navigation', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Select File', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Convert File', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Tools', exact: true }).click();
  await page.getByRole('link', { name: 'All local tools', exact: true }).click();
  await expect(page).toHaveURL(/\/tools$/);
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Formats', exact: true })
    .click();
  await expect(page.getByRole('link', { name: 'Formats', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  const headerBackground = await page
    .locator('.header-shell')
    .evaluate((e) => getComputedStyle(e).backgroundColor);
  await page.getByRole('button', { name: 'Switch to light mode', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('.header-shell')).toHaveCSS('background-color', headerBackground);
  await expect(page.locator('.header .brand')).toHaveCSS('color', 'rgb(245, 245, 246)');
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const name of ['Switch to dark mode', 'Open menu']) {
    const bounds = await page.getByRole('button', { name, exact: true }).boundingBox();
    // Browser transform interpolation can report 43.999998px for a 44px target.
    expect(Math.round(bounds.width * 1000) / 1000).toBeGreaterThanOrEqual(44);
    expect(Math.round(bounds.height * 1000) / 1000).toBeGreaterThanOrEqual(44);
  }
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toHaveCount(0);
});

test('local interface has no API or pricing UI and lists every installed tool', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Formats and settings', exact: true }),
  ).toBeVisible();
  expect(await page.locator('body').innerText()).not.toMatch(/API|pricing|subscription|API key/i);
  await page.getByRole('link', { name: 'All converters', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Local conversion tools');
  const registry = await (await page.request.get('/api/registry')).json();
  await expect(page.getByTestId('tool-link')).toHaveCount(registry.pairs.length);
  await page.screenshot({ path: shots + '/local-tools-desktop.png' });
  await page.getByLabel('Search local tools').fill('png to jpg');
  await expect(page.getByTestId('tool-link')).toHaveCount(1);
  await page.getByTestId('tool-link').click();
  await expect(page).toHaveURL(/\/png-to-jpg$/);
  await page.goto('/tools');
  await page.getByLabel('Search local tools').fill('unsupported nonsense');
  await expect(page.getByText('No matching local tools.')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel('Search local tools').fill('');
  await page.getByLabel('Tool category').selectOption('archive');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: shots + '/local-tools-mobile.png' });
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  expect(await page.getByRole('navigation', { name: 'Mobile navigation' }).innerText()).not.toMatch(
    /API|pricing/i,
  );
  await page.goto('/apis/file-conversion');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page not found');
  expect(errors).toEqual([]);
});

test('hero motion animates the connector and cycles only supported conversion pairs', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Select File', exact: true })).toBeEnabled();
  const diagram = page.getByLabel('Conversion formats', { exact: true });
  const initial = await diagram
    .getByRole('button', { name: /Input format:/ })
    .getAttribute('aria-label');
  const transforms = await diagram.locator('.convert-symbol svg').evaluate(async (element) => {
    const before = getComputedStyle(element).transform;
    await new Promise((resolve) => setTimeout(resolve, 200));
    return [before, getComputedStyle(element).transform];
  });
  expect(transforms[0]).not.toBe(transforms[1]);
  await expect(diagram.getByRole('button', { name: /Input format:/ })).not.toHaveAttribute(
    'aria-label',
    initial,
    { timeout: 8000 },
  );
  const source = (
    await diagram.getByRole('button', { name: /Input format:/ }).getAttribute('aria-label')
  )
    .match(/format: (\w+)/)[1]
    .toLowerCase();
  const target = (
    await diagram.getByRole('button', { name: /Output format:/ }).getAttribute('aria-label')
  )
    .match(/format: (\w+)/)[1]
    .toLowerCase();
  const registry = await (await page.request.get('/api/registry')).json();
  expect(registry.pairs.some((pair) => pair.source === source && pair.target === target)).toBe(
    true,
  );
  await expect(diagram.locator('.magic-format-beam')).toHaveCount(1);
  await expect(diagram.locator('.magic-format-beam path')).toHaveCount(2);
});

test('hero motion preserves manually selected formats and conversion routes', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Output format:/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'WEBP', exact: true }).click();
  await page.waitForTimeout(6200);
  await expect(page.getByRole('button', { name: /Output format: WEBP/ })).toBeVisible();
  await page.goto('/png-to-jpg');
  await page.waitForTimeout(6200);
  await expect(page.getByRole('button', { name: /Input format: PNG/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Output format: JPG/ })).toBeVisible();
});

test('hero motion respects reduced motion and pauses off screen', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const input = page.getByRole('button', { name: /Input format:/ });
  const initial = await input.getAttribute('aria-label');
  await page.waitForTimeout(6200);
  await expect(input).toHaveAttribute('aria-label', initial);
  expect(
    await page
      .locator('.format-diagram')
      .evaluate(
        (e) => e.getAnimations({ subtree: true }).filter((a) => a.playState === 'running').length,
      ),
  ).toBe(0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page
    .getByRole('heading', { name: 'Formats and settings', exact: true })
    .scrollIntoViewIfNeeded();
  await expect(page.locator('.format-diagram')).toHaveAttribute('data-motion', 'paused');
});

test('opening the file chooser freezes the suggested conversion before a file is picked', async ({
  page,
}) => {
  await page.goto('/');
  const output = page.getByRole('button', { name: /Output format:/ });
  const initial = await output.getAttribute('aria-label');
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Select File', exact: true }).click();
  const chooser = await chooserPromise;
  await page.waitForTimeout(6200);
  await expect(output).toHaveAttribute('aria-label', initial);
  await chooser.setFiles([]);
});

test('reference homepage, picker search and useful information routes', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const external = [];
  page.on('request', (r) => {
    if (
      !r.url().startsWith('http://127.0.0.1:3107') &&
      !r.url().startsWith('blob:') &&
      !r.url().startsWith('data:')
    )
      external.push(r.url());
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Local File Converter', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Select File', exact: true })).toBeVisible();
  await page.screenshot({ path: shots + '/local-home-desktop.png', fullPage: true });
  await page.getByRole('button', { name: /Input format:/ }).click();
  const picker = page.getByRole('dialog');
  await expect(picker).toBeVisible();
  await picker.getByPlaceholder('Search Format').fill('png');
  await picker.getByRole('button', { name: 'PNG', exact: true }).click();
  await expect(page.getByRole('button', { name: /Input format: PNG/ })).toBeVisible();
  await page.goto('/security');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/Security|Privacy/i);
  await page.goto('/formats');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/Formats/i);
  await page.goto('/help');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('formats catalog exposes every registered conversion through searchable source formats', async ({
  page,
}) => {
  await page.goto('/formats');
  const registry = await (await page.request.get('/api/registry')).json();
  const search = page.getByRole('searchbox', { name: 'Find a format' });
  const reached = new Set();
  for (const format of registry.formats) {
    await search.fill(`.${format.id}`);
    await page
      .getByRole('button', { name: `Show ${format.id.toUpperCase()} conversions`, exact: true })
      .click();
    const outgoing = registry.pairs.filter((pair) => pair.source === format.id);
    const expected = (
      outgoing.length ? outgoing : registry.pairs.filter((pair) => pair.target === format.id)
    )
      .map((pair) => `/${pair.source}-to-${pair.target}`)
      .sort();
    const actual = await page
      .locator('.format-conversion-link')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href')).sort());
    expect(actual).toEqual(expected);
    actual.forEach((route) => reached.add(route));
  }
  expect([...reached].sort()).toEqual(
    registry.pairs.map((pair) => `/${pair.source}-to-${pair.target}`).sort(),
  );
  await search.fill('does-not-exist');
  await expect(
    page.getByRole('heading', { name: 'No matching formats', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.format-conversion-link')).toHaveCount(0);
  await search.press('Escape');
  await expect(search).toHaveValue('');
  await expect(search).toBeFocused();
  await page
    .getByRole('group', { name: 'Format categories', exact: true })
    .getByRole('button', { name: /Audio/ })
    .click();
  await expect(page.getByRole('heading', { name: 'Convert MP3 to…', exact: true })).toBeVisible();
  await search.fill('JPEG');
  await expect(page.getByRole('heading', { name: 'Convert JPG to…', exact: true })).toBeVisible();
  await search.fill('png');
  await page.getByRole('link', { name: 'PNG to JPG converter', exact: true }).click();
  await expect(page).toHaveURL(/\/png-to-jpg$/);
  await expect(
    page.getByRole('heading', { name: 'PNG to JPG Converter', exact: true }),
  ).toBeVisible();
});

test('formats catalog remains usable at mobile, tablet and desktop widths', async ({ page }) => {
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/formats');
    await page.getByRole('searchbox', { name: 'Find a format' }).fill('json');
    await expect(
      page.getByRole('heading', { name: 'Convert JSON to…', exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('button', { name: 'Clear format search', exact: true }).click();
    await page
      .getByRole('group', { name: 'Format categories', exact: true })
      .getByRole('button', { name: /Subtitles/ })
      .click();
    await expect(
      page.getByRole('link', { name: 'SRT to VTT converter', exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
});

test('help guide supports section navigation, searchable answers and converter links', async ({
  page,
}) => {
  await page.goto('/help');
  await expect(page.getByRole('heading', { name: 'Help center', exact: true })).toBeVisible();
  const totalQuestions = await page.locator('.help-question-list details').count();
  for (const name of ['1. Select your files', '2. Set the output', '3. Convert and download'])
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  const registry = await (await page.request.get('/api/registry')).json();
  await expect(page.locator('.help-limits')).toContainText(String(registry.limits.maxFiles));
  await expect(page.locator('.help-limits')).toContainText(
    String(registry.limits.retentionMinutes),
  );
  await page
    .getByRole('navigation', { name: 'Help contents' })
    .getByRole('link', { name: 'Questions & troubleshooting', exact: true })
    .click();
  const heading = page.getByRole('heading', { name: 'Questions & troubleshooting', exact: true });
  await expect(heading).toBeInViewport();
  expect((await heading.boundingBox()).y).toBeGreaterThanOrEqual(100);
  const search = page.getByRole('searchbox', { name: 'Search questions' });
  await search.fill('expired');
  await expect(page.locator('.help-question-list details')).toHaveCount(1);
  await expect(
    page
      .getByRole('navigation', { name: 'Help contents' })
      .getByRole('link', { name: 'Questions & troubleshooting', exact: true }),
  ).toHaveAttribute('aria-current', 'location');
  await page.getByText('My download expired. Can I get it back?', { exact: true }).click();
  await expect(page.locator('.help-question-list details')).toHaveAttribute('open', '');
  await expect(page.locator('.help-question-list details>p')).toContainText(
    `${registry.limits.retentionMinutes} minutes`,
  );
  await search.fill('no-such-answer');
  await expect(
    page.getByRole('heading', { name: 'No matching questions', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Show all questions', exact: true }).click();
  await expect(search).toHaveValue('');
  await expect(search).toBeFocused();
  await expect(page.locator('.help-question-list details')).toHaveCount(totalQuestions);
  await search.fill('transparency');
  await search.press('Escape');
  await expect(search).toHaveValue('');
  const privacyLink = page
    .getByRole('navigation', { name: 'Help contents' })
    .getByRole('link', { name: 'Privacy & limits', exact: true });
  await privacyLink.click();
  await expect(privacyLink).toHaveAttribute('aria-current', 'location');
  await page
    .locator('.help-example-links')
    .getByRole('link', { name: 'PNG JPG', exact: false })
    .click();
  await expect(page).toHaveURL(/\/png-to-jpg$/);
});

test('help content and answers fit narrow mobile through desktop screens', async ({ page }) => {
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/help');
    const search = page.getByRole('searchbox', { name: 'Search questions' });
    await search.fill('privacy');
    await expect(page.locator('.help-question-list details')).toHaveCount(1);
    await page.getByText('Do my files leave this computer?', { exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await search.fill('x'.repeat(140));
    await expect(
      page.getByRole('heading', { name: 'No matching questions', exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await search.press('Escape');
  }
});

test('unregistered conversion routes explain unavailable support without offering a different conversion', async ({
  page,
}) => {
  for (const route of ['/pdf-to-docx', '/png-to-exe', '/unobtainium-converter']) {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Conversion unavailable');
    await expect(
      page.getByText('This conversion is not supported by the tools installed on this computer.', {
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /Input format:/ })).toHaveCount(0);
    await expect(
      page.getByRole('link', { name: 'View supported formats', exact: true }),
    ).toHaveAttribute('href', '/formats');
  }
});

test('real file selection, settings, conversion, download and remove', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/png-to-jpg');
  const png = await sharp({ create: { width: 64, height: 48, channels: 4, background: '#cc3322' } })
    .png()
    .toBuffer();
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Select File', exact: true }).click();
  await (await chooserPromise).setFiles({ name: 'sample.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByText('sample.png', { exact: true })).toBeVisible();
  await page.screenshot({ path: shots + '/local-selected-files.png' });
  await page.getByRole('button', { name: 'Options for sample.png' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const width = page.getByRole('dialog').getByLabel(/Width/i);
  await width.fill('20');
  await page.screenshot({ path: shots + '/local-options.png' });
  await page.getByRole('button', { name: 'Save options', exact: true }).click();
  await page.getByRole('button', { name: 'Convert', exact: true }).click();
  const downloadButton = page.getByRole('link', { name: /Download.*jpg/i });
  await expect(downloadButton).toBeVisible({ timeout: 20000 });
  await expect(downloadButton).toHaveCSS('animation-name', 'local-download-ready');
  await page.screenshot({ path: shots + '/local-completed.png' });
  const downloadPromise = page.waitForEvent('download');
  await downloadButton.click();
  const download = await downloadPromise;
  const bytes = await readFile(await download.path());
  const meta = await sharp(bytes).metadata();
  expect(meta.format).toBe('jpeg');
  expect(meta.width).toBe(20);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(downloadButton).toHaveCSS('animation-name', 'none');
  await page.getByRole('button', { name: 'Remove sample.png', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Select File', exact: true })).toBeVisible();
});

test('corrupt file produces error with retry and no fake download', async ({ page }) => {
  await page.goto('/png-to-jpg');
  const choose = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Select File', exact: true }).click();
  await (
    await choose
  ).setFiles({ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('not a PNG file') });
  await page.getByRole('button', { name: 'Convert', exact: true }).click();
  await expect(page.getByRole('button', { name: /Retry/i })).toBeVisible({ timeout: 20000 });
  expect(await page.getByRole('link', { name: /Download.*jpg/i }).count()).toBe(0);
  await page.screenshot({ path: shots + '/local-error.png' });
});

for (const [name, width, height] of [
  ['mobile', 390, 844],
  ['narrow-mobile', 320, 740],
  ['tablet', 768, 1024],
  ['laptop', 1280, 800],
]) {
  test(`${name} layout has no overflow and usable navigation`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: 'Local File Converter', exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: shots + `/local-home-${name}.png`, fullPage: true });
    await page.goto('/png-to-jpg');
    const choose = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Select File', exact: true }).click();
    const png = await sharp({
      create: { width: 10, height: 10, channels: 3, background: '#dd3333' },
    })
      .png()
      .toBuffer();
    await (
      await choose
    ).setFiles({
      name: 'a-very-long-file-name-that-should-wrap-or-truncate-without-overflowing-the-converter-layout.png',
      mimeType: 'image/png',
      buffer: png,
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: shots + `/local-queue-${name}.png` });
  });
}

test('reduced-motion and keyboard picker dismiss work', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: /Input format:/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('drag and drop batch converts, downloads ZIP and clears files', async ({ page }) => {
  await page.goto('/png-to-jpg');
  await expect(page.getByRole('button', { name: 'Select File', exact: true })).toBeEnabled();
  const png = await sharp({ create: { width: 12, height: 10, channels: 3, background: '#dd3333' } })
    .png()
    .toBuffer();
  const transfer = await page.evaluateHandle(
    (bytes) => {
      const dt = new DataTransfer();
      for (const name of ['first.png', 'second.png'])
        dt.items.add(new File([new Uint8Array(bytes)], name, { type: 'image/png' }));
      return dt;
    },
    [...png],
  );
  await page
    .locator('[aria-label="File drop zone"]')
    .dispatchEvent('drop', { dataTransfer: transfer });
  await expect(page.getByText('first.png', { exact: true })).toBeVisible();
  await expect(page.getByText('second.png', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Convert', exact: true }).click();
  await expect(page.getByRole('link', { name: /Download.*jpg/i })).toHaveCount(2, {
    timeout: 20000,
  });
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download all', exact: true }).click();
  const saved = await readFile(await (await downloadPromise).path());
  const archive = unzipSync(saved);
  expect(Object.keys(archive).sort()).toEqual(['first.jpg', 'second.jpg']);
  for (const bytes of Object.values(archive))
    expect((await sharp(bytes).metadata()).format).toBe('jpeg');
  await page.getByRole('button', { name: 'Clear all', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Select File', exact: true })).toBeVisible();
});

test('route motion moves foreground only and settles after rapid navigation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/formats');
  await expect(page.locator('.format-library')).toBeVisible();
  await page.evaluate(() => {
    window.motionFrames = [];
    const sample = () => {
      const view = document.querySelector('.ui-page-view');
      const hero = document.querySelector('.info-hero,.hero');
      if (view && hero)
        window.motionFrames.push({
          rootOpacity: getComputedStyle(view).opacity,
          rootTransform: getComputedStyle(view).transform,
          heroTransform: getComputedStyle(hero).transform,
          filter: getComputedStyle(view).filter,
          moving: !!document.querySelector('[data-motion-enter="running"]'),
        });
    };
    window.motionObserver = new MutationObserver(sample);
    window.motionObserver.observe(document.getElementById('main'), {
      subtree: true,
      childList: true,
      attributes: true,
    });
  });
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Help', exact: true })
    .click();
  await expect(page.locator('.info-hero h1')).toHaveAttribute(
    'data-motion-enter',
    /running|settled/,
  );
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Formats', exact: true })
    .click();
  await page.getByRole('link', { name: 'Local Converter home', exact: true }).click();
  await expect(page.locator('.hero-copy h1')).toHaveAttribute('data-motion-enter', 'settled');
  const frames = await page.evaluate(() => window.motionFrames);
  expect(frames.some((frame) => frame.moving)).toBe(true);
  expect(
    frames.every(
      (frame) =>
        frame.rootOpacity === '1' &&
        frame.rootTransform === 'none' &&
        frame.heroTransform === 'none' &&
        frame.filter === 'none',
    ),
  ).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Help', exact: true })
    .click();
  await expect(page.locator('.info-hero h1')).toHaveAttribute('data-motion-enter', 'reduced');
  expect(await page.locator('.info-hero h1').evaluate((el) => getComputedStyle(el).transform)).toBe(
    'none',
  );
});

test('spring menus reverse cleanly and keyboard actions remain immediate', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  const tools = page.getByRole('button', { name: 'Tools', exact: true });
  await tools.click();
  await expect(page.locator('#header-tools-menu')).toHaveAttribute(
    'data-motion-engine',
    'react-spring',
  );
  await tools.click();
  await tools.click();
  await expect(page.locator('#header-tools-menu')).not.toHaveAttribute('aria-hidden', 'true');
  await tools.press('Escape');
  await expect(page.locator('#header-tools-menu')).toHaveCount(0);
  await tools.press('Enter');
  expect(
    await page.locator('#header-tools-menu').evaluate((el) => getComputedStyle(el).opacity),
  ).toBe('1');
  await tools.press('Escape');
  await expect(page.locator('#header-tools-menu')).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await tools.click();
  expect(
    await page.locator('#header-tools-menu').evaluate((el) => getComputedStyle(el).opacity),
  ).toBe('1');
});

test('FLIP queue movement preserves real files and options dialog focus', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/png-to-jpg');
  await expect(page.getByRole('button', { name: 'Select File', exact: true })).toBeEnabled();
  const png = await sharp({ create: { width: 14, height: 10, channels: 3, background: '#b93634' } })
    .png()
    .toBuffer();
  await page
    .getByTestId('file-input')
    .setInputFiles(
      ['one', 'two', 'three'].map((name) => ({
        name: `motion-${name}.png`,
        mimeType: 'image/png',
        buffer: png,
      })),
    );
  const survivor = page.getByRole('article', { name: 'File: motion-three.png', exact: true });
  await expect(survivor).toHaveAttribute('data-flip-id', /^file-/);
  await page.evaluate(() => {
    window.rowMoves = [];
    window.rowObserver = new MutationObserver(() => {
      const row = [...document.querySelectorAll('.file-row')].find(
        (el) => el.getAttribute('aria-label') === 'File: motion-three.png',
      );
      if (row) window.rowMoves.push(row.style.transform);
    });
    window.rowObserver.observe(document.querySelector('.workspace-files'), {
      subtree: true,
      attributes: true,
      attributeFilter: ['style'],
    });
  });
  await page.getByRole('button', { name: 'Remove motion-one.png', exact: true }).click();
  await expect(page.locator('.file-row')).toHaveCount(2);
  await expect
    .poll(() => page.evaluate(() => window.rowMoves.some((value) => value.includes('matrix'))))
    .toBe(true);
  const options = page.getByRole('button', { name: 'Options for motion-three.png', exact: true });
  await options.click();
  await expect(page.getByRole('dialog', { name: 'Conversion options' })).toBeVisible();
  await page.getByRole('button', { name: 'Close options', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Conversion options' })).toHaveCount(0);
  await expect(options).toBeFocused();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Remove motion-two.png', exact: true }).click();
  expect(await survivor.evaluate((el) => getComputedStyle(el).transform)).toBe('none');
  await page.getByRole('button', { name: 'Clear all', exact: true }).click();
});

test('FAST progress is lazy, accessible and follows numeric engine signals', async ({ page }) => {
  let progress = 34;
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Select File', exact: true })).toBeEnabled();
  expect(await page.evaluate(() => !!customElements.get('local-conversion-progress'))).toBe(false);
  await page.route('**/api/jobs', (route) =>
    route.fulfill({
      json: {
        jobs: [
          {
            id: 'progress-contract-fixture',
            name: 'progress-fixture.png',
            source: 'png',
            target: 'jpg',
            size: 120,
            status: 'processing',
            progress,
            stage: 'Converting',
          },
        ],
      },
    }),
  );
  await page.goto('/activity');
  const bar = page.getByRole('progressbar', {
    name: 'Conversion progress for progress-fixture.png',
  });
  await expect(bar).toHaveAttribute('value', '34');
  await expect
    .poll(() => page.evaluate(() => !!customElements.get('local-conversion-progress')))
    .toBe(true);
  await expect
    .poll(() =>
      page
        .locator('local-conversion-progress')
        .evaluate((el) => el.shadowRoot.querySelector('.fill').style.transform),
    )
    .toBe('scaleX(0.34)');
  progress = 67;
  await expect(bar).toHaveAttribute('value', '67');
  await expect
    .poll(() =>
      page
        .locator('local-conversion-progress')
        .evaluate((el) => el.shadowRoot.querySelector('.fill').style.transform),
    )
    .toBe('scaleX(0.67)');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(
    await page
      .locator('local-conversion-progress')
      .evaluate((el) => getComputedStyle(el.shadowRoot.querySelector('.fill')).transitionDuration),
  ).toBe('0s');
});

test('shared hover feedback lifts buttons and linked cards without shifting layout', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  const button = page.getByRole('button', { name: 'Select File', exact: true });
  await expect(button).toBeEnabled();
  await expect(page.locator('.upload-card')).toHaveAttribute('data-motion-enter', 'settled');
  const before = await button.evaluate((el) => ({
    left: el.offsetLeft,
    top: el.offsetTop,
    width: el.offsetWidth,
    height: el.offsetHeight,
  }));
  await button.hover();
  await expect.poll(() => button.evaluate((el) => getComputedStyle(el).translate)).toBe('0px -2px');
  expect(
    await button.evaluate((el) => ({
      left: el.offsetLeft,
      top: el.offsetTop,
      width: el.offsetWidth,
      height: el.offsetHeight,
    })),
  ).toEqual(before);
  await page.mouse.move(0, 0);
  await expect.poll(() => button.evaluate((el) => getComputedStyle(el).translate)).toBe('none');
  const card = page.locator('.popular-grid>a').first().locator('.ui-surface');
  await card.scrollIntoViewIfNeeded();
  await expect(card).toHaveAttribute('data-motion-enter', 'settled');
  const cardBefore = await card.evaluate((el) => ({
    height: el.offsetHeight,
    width: el.offsetWidth,
  }));
  await card.hover();
  await expect
    .poll(() =>
      card.evaluate((el) =>
        getComputedStyle(el).transform === 'none'
          ? 0
          : new DOMMatrixReadOnly(getComputedStyle(el).transform).m42,
      ),
    )
    .toBe(-3);
  expect(await card.evaluate((el) => ({ height: el.offsetHeight, width: el.offsetWidth }))).toEqual(
    cardBefore,
  );
  await page.mouse.move(0, 0);
  await expect
    .poll(() =>
      card.evaluate((el) =>
        getComputedStyle(el).transform === 'none'
          ? 0
          : new DOMMatrixReadOnly(getComputedStyle(el).transform).m42,
      ),
    )
    .toBe(0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await card.hover();
  expect(await card.evaluate((el) => getComputedStyle(el).transform)).toBe('none');
  await button.hover();
  expect(await button.evaluate((el) => getComputedStyle(el).translate)).toBe('none');
});

test('cards reveal once in view and newly filtered cards share the same reveal system', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/formats');
  const card = page.locator('.format-conversion-card').first();
  await expect(card).toHaveAttribute('data-motion-kind', 'card');
  await card.scrollIntoViewIfNeeded();
  await expect(card).toHaveAttribute('data-motion-enter', 'settled');
  await page.getByRole('button', { name: 'Show WEBP conversions', exact: true }).click();
  const next = page.locator('.format-conversion-card').first();
  await expect(next).toHaveAttribute('data-motion-kind', 'card');
  await expect(next).toHaveAttribute('data-motion-enter', 'settled');
  const samples = await page
    .locator('.ui-page-view,.info-hero,.format-conversion-card')
    .evaluateAll((elements) =>
      elements.map((el) => ({
        opacity: getComputedStyle(el).opacity,
        filter: getComputedStyle(el).filter,
      })),
    );
  expect(samples.every((value) => value.opacity === '1' && value.filter === 'none')).toBe(true);
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Help', exact: true })
    .click();
  const bottom = page.locator('.help-ready-card');
  await expect(bottom).toHaveAttribute('data-motion-enter', 'pending');
  expect(await bottom.evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
  await bottom.scrollIntoViewIfNeeded();
  await expect(bottom).toHaveAttribute('data-motion-enter', 'settled');
  await page.evaluate(() => window.scrollTo(0, 0));
  await bottom.scrollIntoViewIfNeeded();
  expect(
    await bottom.evaluate(
      (el) => el.getAnimations().filter((a) => a.playState === 'running').length,
    ),
  ).toBe(0);
});

test('touch hover stays still on coarse pointers', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'no-preference',
  });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:3107/');
  const button = page.getByRole('button', { name: 'Select File', exact: true });
  await expect(button).toBeEnabled();
  await expect(page.locator('.upload-card')).toHaveAttribute('data-motion-enter', 'settled');
  expect(await page.evaluate(() => matchMedia('(hover:hover) and (pointer:fine)').matches)).toBe(
    false,
  );
  await button.hover();
  expect(await button.evaluate((el) => getComputedStyle(el).translate)).toBe('none');
  const card = page.locator('.popular-grid>a').first().locator('.ui-surface');
  await card.scrollIntoViewIfNeeded();
  await expect(card).toHaveAttribute('data-motion-enter', 'settled');
  await card.hover();
  expect(await card.evaluate((el) => getComputedStyle(el).transform)).toBe('none');
  await context.close();
});

test('opaque header stays above card icons and text while scrolling in both themes', async ({
  page,
}) => {
  for (const theme of ['light', 'dark']) {
    await page.addInitScript(
      (value) => localStorage.setItem('local-converter-theme', value),
      theme,
    );
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 960 });
      await page.goto('/');
      const card = page.locator('.popular-grid .ui-surface').first();
      const icon = card.locator('.popular-icon');
      await icon.scrollIntoViewIfNeeded();
      await expect(card).toHaveAttribute('data-motion-enter', 'settled');
      await page.evaluate(() => {
        const icon = document.querySelector('.popular-icon');
        window.scrollBy(0, icon.getBoundingClientRect().top - 28);
      });
      const header = page.locator('.header-shell');
      await expect(header).toHaveAttribute('data-scrolled', 'true');
      await expect(header).toHaveCSS('max-width', '1120px');
      const layering = await page.evaluate(() => {
        const header = document.querySelector('.header-shell'),
          icon = document.querySelector('.popular-icon');
        const h = header.getBoundingClientRect(),
          r = icon.getBoundingClientRect();
        const x = Math.max(h.left + 24, Math.min(r.left + r.width / 2, h.right - 24)),
          y = Math.max(h.top + 12, Math.min(r.top + r.height / 2, h.bottom - 12));
        const top = document.elementFromPoint(x, y);
        return {
          headerAtPoint: !!top?.closest('.header-shell'),
          background: getComputedStyle(header).backgroundColor,
          opacity: getComputedStyle(header).opacity,
          point: { x, y },
          top: top?.outerHTML.slice(0, 180),
        };
      });
      expect(layering.headerAtPoint, JSON.stringify(layering)).toBe(true);
      expect(layering.background).toBe('rgb(33, 31, 32)');
      expect(layering.opacity).toBe('1');
    }
  }
});

test('drag feedback lifts the upload emblem and resets without moving the panel', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  const panel = page.locator('.upload-card'),
    emblem = panel.locator('.upload-emblem'),
    drop = page.getByLabel('File drop zone', { exact: true });
  await expect(panel).toHaveAttribute('data-motion-enter', 'settled');
  const before = await panel.boundingBox();
  await drop.dispatchEvent('dragenter');
  await expect.poll(() => emblem.evaluate((el) => getComputedStyle(el).translate)).toBe('0px -4px');
  expect(await panel.boundingBox()).toEqual(before);
  await drop.dispatchEvent('dragleave');
  await expect.poll(() => emblem.evaluate((el) => getComputedStyle(el).translate)).toBe('none');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await drop.dispatchEvent('dragenter');
  expect(await emblem.evaluate((el) => getComputedStyle(el).translate)).toBe('none');
  expect(await emblem.evaluate((el) => getComputedStyle(el).scale)).toBe('none');
  await drop.dispatchEvent('dragleave');
});

test('FAQ content enters on pointer opening, stays native and skips keyboard motion', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/help');
  const detail = page.locator('.help-question-list details').first(),
    summary = detail.locator('summary'),
    answer = detail.locator('p');
  await summary.click();
  await expect(detail).toHaveAttribute('open', '');
  expect(await answer.evaluate((el) => getComputedStyle(el).animationName)).toBe('local-answer-in');
  await summary.click();
  await expect(detail).not.toHaveAttribute('open', '');
  await summary.press('Enter');
  await expect(detail).toHaveAttribute('open', '');
  expect(await answer.evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
  await summary.press('Enter');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await summary.click();
  expect(await answer.evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
  expect(await page.locator('.ui-page-view').evaluate((el) => getComputedStyle(el).opacity)).toBe(
    '1',
  );
});

test('home discovery shows only real format routes and switches every category', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Select File', exact: true })).toBeEnabled();
  const registry = await (await page.request.get('/api/registry')).json();
  await expect(page.locator('.featured-converter')).toHaveCount(1);
  const categories = [...new Set(registry.formats.map((format) => format.category))];
  const explorer = page.getByRole('region', { name: 'Browse formats', exact: true });
  await expect(explorer).toBeVisible();
  for (const id of categories) {
    const button = explorer.locator(`[data-category="${id}"]`);
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    const formats = await explorer
      .locator('.home-format-tags a')
      .evaluateAll((links) =>
        links.map((a) => a.getAttribute('href').slice(1).replace('-converter', '')),
      );
    expect(formats.sort()).toEqual(
      registry.formats
        .filter((format) => format.category === id)
        .map((f) => f.id)
        .sort(),
    );
    const pairs = await explorer
      .locator('.home-pair-links a')
      .evaluateAll((links) => links.map((a) => a.getAttribute('href')));
    expect(pairs.length).toBeGreaterThan(0);
    expect(
      pairs.every((path) =>
        registry.pairs.some((pair) => path === `/${pair.source}-to-${pair.target}`),
      ),
    ).toBe(true);
  }
  await expect(page.getByRole('region', { name: 'Data security', exact: true })).toBeVisible();
  await expect(page.locator('.home-file-flow')).toBeVisible();
  const documents = explorer.locator('[data-category="document"]');
  await documents.focus();
  await documents.press('Enter');
  await expect(documents).toHaveAttribute('aria-pressed', 'true');
  await expect(explorer.locator('.home-category-detail')).toHaveCSS('animation-name', 'none');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await explorer.locator('[data-category="audio"]').click();
  await expect(explorer.locator('.home-category-detail')).toHaveCSS('animation-name', 'none');
  await page.getByRole('link', { name: 'Read conversion guide', exact: true }).click();
  await expect(page).toHaveURL(/\/help$/);
});

test('information pages have descriptive titles and connected learning navigation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  for (const [route, title, tabTitle = title] of [
    ['/formats', 'Supported file formats'],
    ['/help', 'Help center'],
    ['/about', 'About Local Converter', 'About'],
    ['/how-it-works', 'How it works'],
  ]) {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
    await expect(page).toHaveTitle(`${tabTitle} — Local Converter`);
  }
  const registry = await (await page.request.get('/api/registry')).json();
  await expect(page.locator('.learning-limits')).toContainText(
    String(registry.limits.retentionMinutes),
  );
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await nav.getByRole('link', { name: 'About', exact: true }).click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.locator('.about-availability')).toContainText(String(registry.pairs.length));
  await expect(
    page.getByRole('heading', { name: 'Credits and licenses', exact: true }),
  ).toBeVisible();
  await nav.getByRole('link', { name: 'How it works', exact: true }).click();
  await expect(page).toHaveTitle('How it works — Local Converter');
  await page.goBack();
  await expect(page).toHaveTitle('About — Local Converter');
  await page.locator('footer').getByRole('link', { name: 'How it works', exact: true }).click();
  await expect(page).toHaveURL(/\/how-it-works$/);
  await page.getByRole('link', { name: 'Open help center', exact: true }).click();
  await expect(page).toHaveTitle('Help center — Local Converter');
});

test('learning pages preserve selected files and fit mobile navigation', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto('/png-to-jpg');
  await expect(page.getByRole('button', { name: 'Select File', exact: true })).toBeEnabled();
  const buffer = await sharp({
    create: { width: 16, height: 12, channels: 3, background: '#b93634' },
  })
    .png()
    .toBuffer();
  await page
    .getByTestId('file-input')
    .setInputFiles({ name: 'keep-learning.png', mimeType: 'image/png', buffer });
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  for (const name of ['About', 'How it works']) {
    await nav.getByRole('link', { name, exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  }
  await nav.getByRole('link', { name: /My files/ }).click();
  await expect(page.getByText('keep-learning.png', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 320, height: 844 });
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await page
    .getByRole('navigation', { name: 'Mobile navigation' })
    .getByRole('link', { name: 'How it works', exact: true })
    .click();
  await expect(page).toHaveURL(/\/how-it-works$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const limits = await page.locator('.learning-limits').boundingBox(),
    journey = await page.locator('.learning-journey').boundingBox();
  expect(limits.y + limits.height).toBeLessThanOrEqual(journey.y);
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await page
    .getByRole('navigation', { name: 'Mobile navigation' })
    .getByRole('link', { name: 'About', exact: true })
    .click();
  await expect(page).toHaveURL(/\/about$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('format picker fits both themes, starts at the current category and supports mobile categories', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const theme of ['light', 'dark']) {
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/png-to-jpg');
      await page.evaluate((theme) => {
        localStorage.setItem('local-converter-theme', theme);
        document.documentElement.dataset.theme = theme;
      }, theme);
      const anchor = page.getByRole('button', { name: /Input format: PNG/ });
      await anchor.click();
      const dialog = page.getByRole('dialog', { name: 'Select input format' });
      await expect(dialog.getByRole('button', { name: 'PNG', exact: true })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      if (width < 480)
        await dialog.getByRole('combobox', { name: 'File type' }).selectOption('archive');
      else
        await dialog
          .locator('.picker-categories')
          .getByRole('button', { name: /Archives/ })
          .click();
      await expect(dialog.getByRole('button', { name: 'ZIP', exact: true })).toBeVisible();
      expect(
        await dialog.evaluate((el) =>
          [...el.querySelectorAll('.picker-body,.picker-categories,.picker-results')]
            .filter((e) => getComputedStyle(e).display !== 'none')
            .every((e) => e.scrollWidth <= e.clientWidth),
        ),
      ).toBe(true);
      const box = await dialog.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(box.y + box.height).toBeLessThanOrEqual(900);
      await dialog.getByPlaceholder('Search Format').fill('unavailable-format');
      await expect(dialog.getByText('No matching formats', { exact: true })).toBeVisible();
      await dialog.getByRole('button', { name: 'Clear search', exact: true }).click();
      await expect(dialog.getByRole('button', { name: 'ZIP', exact: true })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(anchor).toBeFocused();
    }
  }
});

test('LC brand and favicon assets share the selected vector and remain visible in both themes', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const brand = page.locator('.header .brand svg[data-brand="local-converter"]');
  await expect(brand).toBeVisible();
  await expect(brand.locator('path')).toHaveCount(3);
  await expect(brand.locator('path').first()).toHaveAttribute('fill', 'currentColor');
  const headerFill = await brand
    .locator('path')
    .first()
    .evaluate((el) => getComputedStyle(el).fill);
  await page.getByRole('button', { name: /Switch to .* mode/ }).click();
  expect(
    await brand
      .locator('path')
      .first()
      .evaluate((el) => getComputedStyle(el).fill),
  ).toBe(headerFill);
  await expect(page.locator('.footer-brand svg[data-brand="local-converter"]')).toBeVisible();
  const icons = await page
    .locator('head link[rel="icon"]')
    .evaluateAll((links) => links.map((link) => link.href));
  expect(icons).toHaveLength(3);
  for (const url of icons) {
    const response = await page.request.get(url);
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).not.toContain('text/html');
  }
  const manifestResponse = await page.request.get('/site.webmanifest');
  expect(manifestResponse.ok()).toBe(true);
  const manifest = await manifestResponse.json();
  expect(manifest.name).toBe('Local Converter');
  for (const icon of manifest.icons) {
    const response = await page.request.get(icon.src);
    expect(response.ok()).toBe(true);
    const metadata = await sharp(await response.body()).metadata();
    expect(`${metadata.width}x${metadata.height}`).toBe(icon.sizes);
  }
  const touch = await page.request.get('/apple-touch-icon.png');
  const touchMeta = await sharp(await touch.body()).metadata();
  expect(touchMeta.width).toBe(180);
  expect(touchMeta.height).toBe(180);
  const ico = await (await page.request.get('/favicon.ico')).body();
  expect(ico.readUInt16LE(2)).toBe(1);
  expect(ico.readUInt16LE(4)).toBe(3);
  for (let i = 0; i < 3; i++) {
    const entry = 6 + 16 * i,
      offset = ico.readUInt32LE(entry + 12),
      length = ico.readUInt32LE(entry + 8);
    const meta = await sharp(ico.subarray(offset, offset + length)).metadata();
    expect(meta.width).toBe([16, 32, 48][i]);
  }
});

test('footer destinations have complete reading pages and preserve a pending workspace through recovery', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/png-to-jpg');
  const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#b93634' } })
    .png()
    .toBuffer();
  await page
    .getByTestId('file-input')
    .setInputFiles({ name: 'keep-across-pages.png', mimeType: 'image/png', buffer: png });
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'About', exact: true })
    .click();
  const expected = [
    ['File converter', '/', 'Local File Converter'],
    ['Supported formats', '/formats', 'Supported file formats'],
    ['Local tools', '/tools', 'Local conversion tools'],
    ['About', '/about', 'About Local Converter'],
    ['How it works', '/how-it-works', 'How it works'],
    ['Help center', '/help', 'Help center'],
    ['Data security', '/security', 'Data security'],
    ['Privacy', '/privacy', 'Privacy'],
    ['Terms of use', '/terms', 'Terms of use'],
  ];
  for (const [label, path, title] of expected) {
    await page.locator('.footer').getByRole('link', { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(path === '/' ? '/$' : path + '$'));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
    if (['/security', '/privacy', '/terms'].includes(path))
      expect((await page.locator('main').innerText()).split(/\s+/).length).toBeGreaterThan(650);
    await expect(page.locator('.activity-nav-link')).toContainText('1');
  }
  await page.locator('.footer').getByRole('link', { name: 'Help center', exact: true }).click();
  await page.getByRole('link', { name: 'Browse recovery guides', exact: true }).click();
  await expect(page).toHaveURL(/\/errors$/);
  await page.locator('.recovery-directory>a[href="/404"]').click();
  await page.getByRole('link', { name: 'Return to my files', exact: true }).click();
  await expect(page.getByText('keep-across-pages.png', { exact: true })).toBeVisible();
});

test('connection recovery retries the real local service without a document reload', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let unavailable = true;
  await page.route('**/api/registry', (route) =>
    unavailable ? route.abort('failed') : route.continue(),
  );
  await page.goto('/png-to-jpg');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Local server unavailable');
  await page.evaluate(() => {
    window.connectionRecoveryMarker = 'same-document';
  });
  unavailable = false;
  await page.getByRole('button', { name: 'Try connection again', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('PNG to JPG Converter');
  await expect(page.getByRole('button', { name: 'Select File', exact: true })).toBeEnabled();
  expect(await page.evaluate(() => window.connectionRecoveryMarker)).toBe('same-document');
});

test('recovery previews are honest, linked and have useful recovery actions', async ({ page }) => {
  const kinds = [
    '400',
    '401',
    '403',
    '404',
    '408',
    '409',
    '410',
    '413',
    '415',
    '422',
    '429',
    '500',
    '503',
    'offline',
  ];
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/errors');
  await expect(page.locator('.recovery-directory>a')).toHaveCount(kinds.length);
  for (const kind of kinds) {
    await page.goto('/' + kind);
    await expect(page.getByText('Error page preview', { exact: true })).toBeVisible();
    await expect(page.locator('.recovery-next li')).toHaveCount(3);
    await expect(page.locator('.recovery-actions>.primary-button')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await page.goto('/this-page-does-not-exist');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page not found');
  await expect(page.getByText('Error page preview', { exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Back to converter', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Local File Converter');
});

test('a page render failure is caught and another information page remains available', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/registry', async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    data.formats.find((format) => format.id === 'png').label = { unexpected: 'object' };
    await route.fulfill({ response, json: data });
  });
  await page.goto('/about');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('About Local Converter');
  const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#b93634' } })
    .png()
    .toBuffer();
  await page
    .getByTestId('file-input')
    .setInputFiles({ name: 'survives-render-error.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByText('survives-render-error.png', { exact: true })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Formats', exact: true })
    .click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Something interrupted this page',
  );
  await expect(page.locator('.header .brand')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Try this page again', exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Return to my files', exact: true }).click();
  await expect(page.getByText('survives-render-error.png', { exact: true })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'About', exact: true })
    .click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('About Local Converter');
});

test('policy contents collapse on mobile and section links stay below the header', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [390, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/privacy');
    const contents = page.locator('.policy-mobile-contents');
    await expect(contents).not.toHaveAttribute('open', '');
    await contents.locator('summary').click();
    await expect(contents).toHaveAttribute('open', '');
    await contents.locator('a[href="#retention"]').click();
    const top = await page.locator('#retention').evaluate((el) => el.getBoundingClientRect().top);
    expect(top).toBeGreaterThanOrEqual(90);
    expect(top).toBeLessThanOrEqual(115);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
});

test('Tools shows only real converters and categories open on hover without clicking', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/security');
  await expect(page.locator('.header .local-status')).toHaveText('Runs on your computer');
  const registry = await (await page.request.get('/api/registry')).json();
  const formats = new Map(registry.formats.map((format) => [format.id, format]));
  const tools = page.getByRole('button', { name: 'Tools', exact: true }),
    menu = page.locator('#header-tools-menu');
  await tools.hover();
  await expect(tools).toHaveAttribute('aria-expanded', 'true');
  await expect(
    menu.locator('a[href="/formats"],a[href="/help"],a[href="/about"],a[href="/how-it-works"]'),
  ).toHaveCount(0);
  for (const [category, label] of [
    ['image', 'Images'],
    ['document', 'Documents'],
    ['audio', 'Audio'],
    ['video', 'Video'],
    ['archive', 'Archives'],
    ['spreadsheet', 'Spreadsheets'],
    ['data', 'Data'],
    ['vector', 'Vector'],
    ['subtitle', 'Subtitles'],
  ]) {
    const button = menu.getByRole('button', { name: label, exact: true });
    await button.hover();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    const expected = registry.pairs
      .filter((pair) => formats.get(pair.source)?.category === category)
      .map((pair) => `/${pair.source}-to-${pair.target}`)
      .sort();
    expect(
      await menu
        .locator('.tools-menu-links>a')
        .evaluateAll((links) => links.map((link) => link.getAttribute('href')).sort()),
    ).toEqual(expected);
  }
  await menu.getByRole('button', { name: 'Images', exact: true }).hover();
  const converter = menu.getByRole('link', { name: 'PNG to JPG', exact: true });
  await converter.hover();
  await expect(menu).toBeVisible();
  await converter.click();
  await expect(page).toHaveURL(/\/png-to-jpg$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('PNG to JPG Converter');
  await expect(menu).toHaveCount(0);
});

test('Tools category keyboard navigation and escape keep focus predictable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('.header .local-status')).toHaveText('Runs on your computer');
  const tools = page.getByRole('button', { name: 'Tools', exact: true }),
    menu = page.locator('#header-tools-menu');
  await tools.focus();
  await tools.press('Enter');
  await page.keyboard.press('Tab');
  await expect(menu.getByRole('link', { name: 'All local tools', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(menu.getByRole('button', { name: 'Images', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  const documents = menu.getByRole('button', { name: 'Documents', exact: true });
  await expect(documents).toBeFocused();
  await expect(documents).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('ArrowRight');
  await expect(menu.locator('.tools-menu-links>a').first()).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(documents).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(tools).toBeFocused();
  await tools.press('Enter');
  await expect(menu).toBeVisible();
  await page.mouse.click(8, 300);
  await expect(menu).toHaveCount(0);
});

test('essential image tools resize, compress and crop real downloadable images', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const buffer = await sharp({
    create: { width: 80, height: 60, channels: 4, background: '#b93634' },
  })
    .png()
    .toBuffer();
  async function choose(route) {
    await page.goto(route);
    await expect(page.getByTestId('utility-file-input')).toBeEnabled();
    await page
      .getByTestId('utility-file-input')
      .setInputFiles({ name: 'sample.png', mimeType: 'image/png', buffer });
  }
  async function output() {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('link', { name: 'Download result', exact: true }).click(),
    ]);
    return readFile(await download.path());
  }
  await choose('/resize-image');
  await page.getByLabel('Width (px)', { exact: true }).fill('30');
  await page.getByLabel('Height (px)', { exact: true }).fill('20');
  await page.getByRole('button', { name: 'Resize image', exact: true }).click();
  let meta = await sharp(await output()).metadata();
  expect(meta.width).toBe(30);
  expect(meta.height).toBe(20);
  await choose('/compress-image');
  await page.getByLabel('Target size (KB)', { exact: true }).fill('20');
  await page.getByRole('button', { name: 'Compress image', exact: true }).click();
  expect((await output()).length).toBeLessThanOrEqual(20 * 1024);
  await choose('/crop-image');
  await expect(page.getByLabel('Crop width (px)', { exact: true })).toHaveValue('80');
  await page.getByLabel('Crop left (px)', { exact: true }).fill('10');
  await page.getByLabel('Crop top (px)', { exact: true }).fill('5');
  await page.getByLabel('Crop width (px)', { exact: true }).fill('20');
  await page.getByLabel('Crop height (px)', { exact: true }).fill('10');
  await page.getByLabel('Rotate after cropping', { exact: true }).selectOption('90');
  await page.getByRole('button', { name: 'Save cropped image', exact: true }).click();
  meta = await sharp(await output()).metadata();
  expect(meta.width).toBe(10);
  expect(meta.height).toBe(20);
});

test('PDF tools preserve draft order across pages, merge, split and combine images into a PDF', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const a = await PDFDocument.create(),
    b = await PDFDocument.create();
  a.addPage([200, 300]);
  a.addPage([210, 300]);
  b.addPage([220, 300]);
  const pdfA = Buffer.from(await a.save()),
    pdfB = Buffer.from(await b.save());
  await page.goto('/merge-pdf');
  await expect(page.getByTestId('utility-file-input')).toBeEnabled();
  await page.getByTestId('utility-file-input').setInputFiles([
    { name: 'a.pdf', mimeType: 'application/pdf', buffer: pdfA },
    { name: 'b.pdf', mimeType: 'application/pdf', buffer: pdfB },
  ]);
  await page.getByRole('button', { name: 'Move b.pdf up', exact: true }).click();
  await page.locator('.footer').getByRole('link', { name: 'About', exact: true }).click();
  await page.locator('.activity-nav-link').click();
  await page.locator('.utility-draft-notice').getByRole('link').click();
  expect(await page.locator('.utility-file-list strong').allTextContents()).toEqual([
    'b.pdf',
    'a.pdf',
  ]);
  await page.getByRole('button', { name: 'Merge PDFs', exact: true }).click();
  let [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: 'Download result', exact: true }).click(),
  ]);
  const merged = await readFile(await download.path());
  expect((await PDFDocument.load(merged)).getPages().map((p) => p.getWidth())).toEqual([
    220, 200, 210,
  ]);
  await page.goto('/split-pdf');
  await expect(page.getByTestId('utility-file-input')).toBeEnabled();
  await page
    .getByTestId('utility-file-input')
    .setInputFiles({ name: 'merged.pdf', mimeType: 'application/pdf', buffer: merged });
  await page.getByLabel('Pages to keep', { exact: true }).fill('2-3');
  await page.getByLabel('Download as', { exact: true }).selectOption('separate');
  await page.getByRole('button', { name: 'Split PDF', exact: true }).click();
  [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: 'Download result', exact: true }).click(),
  ]);
  const files = unzipSync(await readFile(await download.path()));
  expect(Object.keys(files)).toEqual(['page-002.pdf', 'page-003.pdf']);
  expect((await PDFDocument.load(files['page-002.pdf'])).getPage(0).getWidth()).toBe(200);
  const landscape = await sharp({
      create: { width: 80, height: 60, channels: 3, background: 'red' },
    })
      .png()
      .toBuffer(),
    portrait = await sharp({ create: { width: 60, height: 80, channels: 3, background: 'blue' } })
      .png()
      .toBuffer();
  await page.goto('/images-to-pdf');
  await expect(page.getByTestId('utility-file-input')).toBeEnabled();
  await page.getByTestId('utility-file-input').setInputFiles([
    { name: 'landscape.png', mimeType: 'image/png', buffer: landscape },
    { name: 'portrait.png', mimeType: 'image/png', buffer: portrait },
  ]);
  await page.getByRole('button', { name: 'Move portrait.png up', exact: true }).click();
  await page.getByRole('button', { name: 'Create PDF', exact: true }).click();
  [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: 'Download result', exact: true }).click(),
  ]);
  const pdf = await PDFDocument.load(await readFile(await download.path()));
  expect(pdf.getPageCount()).toBe(2);
  expect(pdf.getPage(0).getHeight()).toBeGreaterThan(pdf.getPage(0).getWidth());
});

test('essential tools are discoverable and responsive in both themes', async ({ page }) => {
  test.setTimeout(90000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('.everyday-tool-card')).toHaveCount(6);
  await page
    .locator('.everyday-tools')
    .getByRole('link', { name: /Compress image/ })
    .click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Compress image');
  for (const theme of ['light', 'dark'])
    for (const width of [320, 390, 768, 1440])
      for (const route of [
        '/compress-image',
        '/resize-image',
        '/crop-image',
        '/merge-pdf',
        '/split-pdf',
        '/images-to-pdf',
      ]) {
        await page.setViewportSize({ width, height: 960 });
        await page.goto(route);
        await expect(page.getByTestId('utility-file-input')).toBeEnabled();
        const current = await page.locator('html').getAttribute('data-theme');
        if (current !== theme)
          await page.getByRole('button', { name: `Switch to ${theme} mode`, exact: true }).click();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        const hero = await page.locator('.info-hero').boundingBox();
        expect(hero.height).toBe(width <= 600 ? 460 : width <= 900 ? 520 : 576);
        if (width === 1440 && route === '/compress-image') {
          await page.locator('.utility-workspace').scrollIntoViewIfNeeded();
          await page.screenshot({ path: `${shots}/essential-compress-${theme}.png` });
        }
      }
  expect(errors).toEqual([]);
});

test('complete toolbox routes render valid settings and stay within mobile and desktop viewports', async ({
  page,
}) => {
  test.setTimeout(180000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/tools');
  const registry = await (await page.request.get('/api/registry')).json();
  expect(registry.tools.length).toBeGreaterThanOrEqual(79);
  await expect(page.locator('.everyday-tool-card')).toHaveCount(registry.tools.length);
  await page.getByRole('searchbox', { name: 'Search local tools' }).fill('background');
  await expect(page.locator('.everyday-tool-card')).toHaveCount(2);
  await page.getByRole('searchbox', { name: 'Search local tools' }).fill('');
  for (const tool of registry.tools) {
    await page.goto('/' + tool.id);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(tool.title);
    await expect(page.getByTestId('utility-file-input')).toBeEnabled();
    expect(
      await page
        .locator('.utility-settings')
        .evaluate((form) =>
          [...form.querySelectorAll('input,select,textarea')].every((input) =>
            input.checkValidity(),
          ),
        ),
      'Invalid defaults for ' + tool.id,
    ).toBe(true);
  }
  for (const theme of ['light', 'dark'])
    for (const width of [320, 390, 1440])
      for (const route of [
        '/tools',
        '/photo-background',
        '/transform-video',
        '/render-html',
        '/fill-pdf-form',
        '/create-code',
        '/structured-data',
        '/resize-print-image',
      ]) {
        await page.setViewportSize({ width, height: 960 });
        await page.goto(route);
        if ((await page.locator('html').getAttribute('data-theme')) !== theme)
          await page.getByRole('button', { name: `Switch to ${theme} mode`, exact: true }).click();
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          route + ' ' + width + ' ' + theme,
        ).toBe(true);
        if (width === 1440) {
          await page
            .locator(route === '/tools' ? '.everyday-tools-heading' : '.utility-workspace')
            .scrollIntoViewIfNeeded();
          if (route === '/tools' || route === '/create-code')
            await page.screenshot({ path: `${shots}/complete-${route.slice(1)}-${theme}.png` });
        }
      }
  expect(errors).toEqual([]);
});

test('text, image and password toolbox workflows create usable downloads through queued workers', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  async function download() {
    const [result] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('link', { name: 'Download result', exact: true }).last().click(),
    ]);
    return readFile(await result.path());
  }
  await page.goto('/create-code');
  await expect(page.getByTestId('utility-file-input')).toBeEnabled();
  await page.getByRole('textbox', { name: 'Tool input text' }).fill('https://localconverter.dev');
  await page.getByRole('button', { name: 'Create result', exact: true }).click();
  let output = await download();
  expect((await sharp(output).metadata()).width).toBe(600);
  await page.getByText('View image preview', { exact: true }).click();
  await expect(page.getByAltText('QR & barcode maker result preview')).toBeVisible();
  await page.goto('/read-code');
  await expect(page.getByTestId('utility-file-input')).toBeEnabled();
  await page
    .getByTestId('utility-file-input')
    .setInputFiles({ name: 'qr.png', mimeType: 'image/png', buffer: output });
  await page.getByRole('button', { name: 'Create result', exact: true }).click();
  expect((await download()).toString()).toBe('https://localconverter.dev');
  await page.goto('/structured-data');
  await expect(page.getByTestId('utility-file-input')).toBeEnabled();
  await page.getByRole('textbox', { name: 'Tool input text' }).fill('{"hello":"world"}');
  await page.getByLabel('Output syntax', { exact: true }).selectOption('xml');
  await page.getByRole('button', { name: 'Create result', exact: true }).click();
  expect((await download()).toString()).toContain('<hello>world</hello>');
  const pdf = await PDFDocument.create();
  pdf.addPage([200, 300]);
  await page.goto('/protect-pdf');
  await expect(page.getByTestId('utility-file-input')).toBeEnabled();
  await page
    .getByTestId('utility-file-input')
    .setInputFiles({
      name: 'private.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from(await pdf.save()),
    });
  await page.getByLabel('Open password', { exact: true }).fill('test-local-secret');
  await page.getByRole('button', { name: 'Process document', exact: true }).click();
  output = await download();
  expect(output.subarray(0, 5).toString()).toBe('%PDF-');
  const jobs = await (await page.request.get('/api/jobs')).json();
  expect(JSON.stringify(jobs)).not.toContain('test-local-secret');
  await page.goto('/unlock-pdf');
  await expect(page.getByTestId('utility-file-input')).toBeEnabled();
  await page
    .getByTestId('utility-file-input')
    .setInputFiles({ name: 'encrypted.pdf', mimeType: 'application/pdf', buffer: output });
  await page.getByLabel('Known open password', { exact: true }).fill('test-local-secret');
  await page.getByRole('button', { name: 'Process document', exact: true }).click();
  expect((await PDFDocument.load(await download())).getPageCount()).toBe(1);
});

test('all 240 operation pages have dedicated interactive workspaces, how-to guides, FAQs and route metadata', async ({
  page,
}) => {
  test.setTimeout(240000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/tools');
  const registry = await (await page.request.get('/api/registry')).json();
  const paths = [
    ...registry.tools.map((tool) => '/' + tool.id),
    ...registry.pairs.map((pair) => `/${pair.source}-to-${pair.target}`),
  ];
  expect(paths).toHaveLength(registry.tools.length + registry.pairs.length);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const [index, path] of paths.entries()) {
    await page.goto(path);
    await expect(
      page.getByTestId(index < registry.tools.length ? 'utility-file-input' : 'file-input'),
    ).toBeEnabled();
    await expect(page.locator('.operation-guide')).toHaveAttribute('data-page-guide', path);
    await expect(page.locator('#guide-how-to .guide-steps>li')).toHaveCount(4);
    await expect(page.locator('#guide-faq details')).toHaveCount(6);
    expect(await page.locator('link[rel="canonical"]').getAttribute('href')).toBe(
      'http://127.0.0.1:3107' + path,
    );
    expect(await page.locator('meta[name="description"]').getAttribute('content')).not.toBe(
      'Convert files on your own computer. Local image, document, audio, video and data conversion.',
    );
    expect(await page.getByRole('heading', { level: 1 }).count()).toBe(1);
    const schema = await page.locator('#page-schema').textContent();
    expect(schema).toContain('WebApplication');
    expect(schema).toContain('3107' + path);
  }
  expect(errors).toEqual([]);
});

test('expanded workspaces and long guides fit both themes and retain usable anchored FAQs', async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const shots = '.artifacts/screenshots';
  for (const theme of ['light', 'dark'])
    for (const width of [320, 768, 1440])
      for (const route of [
        '/icon-favicon',
        '/compress-image',
        '/merge-pdf',
        '/normalize-audio',
        '/render-html',
        '/create-code',
        '/png-to-jpg',
        '/pdf-to-png',
        '/txt-to-gz',
        '/xlsx-to-json',
        '/mp4-to-mp3',
      ]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto(route);
        await expect(page.locator('.operation-guide')).toHaveAttribute('data-page-guide', route);
        if ((await page.locator('html').getAttribute('data-theme')) !== theme)
          await page.getByRole('button', { name: `Switch to ${theme} mode`, exact: true }).click();
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          route + ' ' + width + ' ' + theme,
        ).toBe(true);
        if (route === '/icon-favicon' && width === 1440) {
          expect(
            (await page.locator('.utility-workspace').boundingBox()).height,
          ).toBeGreaterThanOrEqual(600);
          await page.locator('.utility-workspace').scrollIntoViewIfNeeded();
          await page.screenshot({ path: `${shots}/expanded-icon-workspace-${theme}.png` });
          await page.locator('#guide-how-to').scrollIntoViewIfNeeded();
          await page.screenshot({ path: `${shots}/expanded-icon-guide-${theme}.png` });
        }
      }
  await page.goto('/icon-favicon');
  await page.locator('.guide-contents').getByRole('link', { name: 'FAQs', exact: true }).click();
  await page.locator('#guide-faq details').first().locator('summary').click();
  await expect(page.locator('#guide-faq details').first()).toHaveAttribute('open', '');
  expect((await page.locator('#guide-faq').boundingBox()).y).toBeGreaterThan(80);
});

test('guides are readable in the server HTML without JavaScript and metadata follows SPA navigation', async ({
  browser,
  page,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false }),
    reader = await context.newPage();
  await reader.goto('http://127.0.0.1:3107/icon-favicon');
  await expect(reader.getByRole('heading', { level: 1 })).toHaveText('ICO and favicon pack');
  await expect(reader.locator('#guide-how-to')).toBeVisible();
  await reader.locator('#guide-faq details').first().locator('summary').click();
  await expect(reader.locator('#guide-faq details').first().locator('p')).toBeVisible();
  await context.close();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/png-to-jpg');
  await expect(page.locator('#guide-faq')).toBeAttached();
  await page
    .locator('.guide-related')
    .getByRole('link', { name: 'PNG to WEBP', exact: true })
    .click();
  await expect(page).toHaveURL(/png-to-webp$/);
  await expect(page.locator('.operation-guide')).toHaveAttribute('data-page-guide', '/png-to-webp');
  expect(await page.locator('link[rel="canonical"]').getAttribute('href')).toBe(
    'http://127.0.0.1:3107/png-to-webp',
  );
  await page.locator('.footer').getByRole('link', { name: 'About', exact: true }).click();
  await expect
    .poll(
      async () =>
        JSON.parse(await page.locator('#page-schema').textContent())['@graph'][0]['@type'],
    )
    .toBe('AboutPage');
  expect(await page.locator('link[rel="canonical"]').getAttribute('href')).toBe(
    'http://127.0.0.1:3107/about',
  );
});

test('guide navigation is distinct, tracks the reading section and keeps anchors clear of the header', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const theme of ['light', 'dark'])
    for (const width of [320, 768, 1440])
      for (const route of ['/animation-to-video', '/png-to-jpg']) {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto(route);
        await expect(
          page.getByTestId(route === '/png-to-jpg' ? 'file-input' : 'utility-file-input'),
        ).toBeEnabled();
        if ((await page.locator('html').getAttribute('data-theme')) !== theme)
          await page.getByRole('button', { name: `Switch to ${theme} mode`, exact: true }).click();
        const nav = page.getByRole('navigation', { name: 'On this page' }),
          panel = nav.locator('.guide-contents-panel');
        await expect(nav.getByRole('link')).toHaveCount(5);
        await nav.getByRole('link', { name: 'Settings', exact: true }).click();
        await expect(nav.getByRole('link', { name: 'Settings', exact: true })).toHaveAttribute(
          'aria-current',
          'location',
        );
        expect((await page.locator('#guide-settings').boundingBox()).y).toBeGreaterThanOrEqual(180);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        const surface = await panel.evaluate((el) => ({
          background: getComputedStyle(el).backgroundColor,
          border: getComputedStyle(el).borderTopWidth,
          radius: getComputedStyle(el).borderRadius,
        }));
        expect(surface.background).not.toBe('rgba(0, 0, 0, 0)');
        expect(surface.border).toBe('1px');
        expect(surface.radius).toBe('14px');
        if (width === 1440 && route === '/animation-to-video') {
          await page
            .locator('#guide-settings .guide-settings>div')
            .nth(2)
            .evaluate((el) => el.scrollIntoView({ block: 'center' }));
          await expect(nav.getByRole('link', { name: 'Settings', exact: true })).toHaveAttribute(
            'aria-current',
            'location',
          );
          const bounds = await panel.boundingBox();
          expect(bounds.y).toBeGreaterThan(78);
          expect(bounds.y).toBeLessThan(110);
          await page.screenshot({ path: `.artifacts/screenshots/guide-navigation-${theme}.png` });
        }
        await nav.getByRole('link', { name: 'Example', exact: true }).click();
        await expect(nav.getByRole('link', { name: 'Example', exact: true })).toHaveAttribute(
          'aria-current',
          'location',
        );
        await page.locator('#guide-faq').evaluate((el) => el.scrollIntoView({ block: 'start' }));
        await expect(nav.getByRole('link', { name: 'FAQs', exact: true })).toHaveAttribute(
          'aria-current',
          'location',
        );
        await nav.getByRole('link', { name: 'Limits', exact: true }).click();
        await expect(nav.getByRole('link', { name: 'Limits', exact: true })).toHaveAttribute(
          'aria-current',
          'location',
        );
        expect((await page.locator('#guide-limits').boundingBox()).y).toBeGreaterThanOrEqual(180);
      }
});
