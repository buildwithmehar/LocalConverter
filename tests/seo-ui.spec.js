import { test, expect } from '@playwright/test';

test('private workspace keeps Analytics absent and local discovery private', async ({ page }) => {
  const analytics = [];
  page.on('request', (request) => {
    if (/googletagmanager|google-analytics/.test(request.url())) analytics.push(request.url());
  });
  await page.goto('/generate-id');
  await expect(page.locator('.utility-workspace')).toBeVisible();
  await expect(page.locator('script[src*="googletagmanager"]')).toHaveCount(0);
  for (const resource of ['robots.txt', 'llms.txt', 'llms-full.txt', 'humans.txt']) {
    const response = await page.request.get('/' + resource);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/plain');
    if (resource === 'robots.txt') expect(await response.text()).toContain('Disallow: /');
    else {
      expect(response.headers()['x-robots-tag']).toBe('noindex');
      expect(await response.text()).toContain('Private local application');
    }
  }
  expect(analytics).toEqual([]);
});

test('discovery content, canonical metadata and entities stay coherent through SPA navigation', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Local File Converter');
  const original = await page.evaluate(() => (window.navigationMarker = 'same-document'));
  for (const route of [
    '/image-converter',
    '/png-converter',
    '/to-png',
    '/tools',
    '/formats',
    '/about',
    '/privacy',
    '/help',
    '/',
  ]) {
    if (route === '/png-converter') {
      await page.locator('.footer a[href="/formats"]').click();
      await page.locator('a[href="/png-converter"]').filter({ visible: true }).first().click();
    } else await page.locator(`a[href="${route}"]`).filter({ visible: true }).first().click();
    await expect(page).toHaveURL(new RegExp(route === '/' ? '/$' : route + '$'));
    await expect(page.locator('[data-search-guide]')).toHaveAttribute('data-search-guide', route);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'http://127.0.0.1:3111' + route,
    );
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow');
    const schema = JSON.parse(await page.locator('#page-schema').textContent());
    expect(schema['@graph'][0].url).toBe('http://127.0.0.1:3111' + route);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      'content',
      'http://127.0.0.1:3111/social-card.png',
    );
    await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute(
      'content',
      await page.title(),
    );
    expect(await page.evaluate(() => window.navigationMarker)).toBe(original);
  }
});

test('raw discovery works without JavaScript and local UI fits narrow screens in both themes', async ({
  browser,
  page,
}) => {
  const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 390, height: 844 },
    }),
    raw = await context.newPage();
  await raw.goto('http://127.0.0.1:3111/tools');
  await expect(raw.getByRole('heading', { level: 1 })).toHaveText('Local Conversion Tools');
  await expect(raw.locator('a[href="/merge-pdf"]')).toBeVisible();
  await raw.locator('a[href="/merge-pdf"]').click();
  await expect(raw.locator('#guide-how-to')).toBeVisible();
  await context.close();
  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const theme of ['dark', 'light'])
    for (const route of [
      '/',
      '/tools',
      '/formats',
      '/image-converter',
      '/png-converter',
      '/privacy',
    ]) {
      await page.goto(route);
      await page.evaluate((theme) => {
        document.documentElement.dataset.theme = theme;
        localStorage.setItem('local-converter-theme', theme);
      }, theme);
      await expect(page.locator('[data-search-guide]')).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        `${route} ${theme}`,
      ).toBe(true);
    }
});
