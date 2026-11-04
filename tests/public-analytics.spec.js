import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve, join, dirname, extname } from 'node:path';

const root = resolve('dist-public');
function headersFor(href, text) {
  const url = new URL(href),
    headers = {};
  let pattern = '';
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('/') || line.startsWith('https://')) pattern = line.trim();
    else if (line.startsWith('  ') && pattern) {
      const expression =
        '^' +
        pattern
          .split(/(:[A-Za-z]\w*|\*)/)
          .map((part) =>
            part === '*'
              ? '.*'
              : part.startsWith(':')
                ? '[^./]+'
                : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
          )
          .join('') +
        '$';
      const candidate = pattern.startsWith('https://')
        ? 'https://' + url.hostname + url.pathname
        : url.pathname;
      if (new RegExp(expression).test(candidate)) {
        const index = line.indexOf(':'),
          name = line.slice(2, index).toLowerCase(),
          value = line.slice(index + 1).trim();
        headers[name] = headers[name] ? headers[name] + ', ' + value : value;
      }
    }
  }
  return headers;
}
async function publicContext(browser) {
  const context = await browser.newContext(),
    requests = [],
    errors = [];
  const rules = await readFile(join(root, '_headers'), 'utf8');
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    requests.push(url.href);
    if (url.hostname === 'www.googletagmanager.com' && url.pathname === '/gtag/js')
      return route.fulfill({
        contentType: 'application/javascript',
        body: 'window.__testGoogleLoader=(window.__testGoogleLoader||0)+1;',
      });
    if (
      url.hostname !== 'localconverter.tech' &&
      url.hostname !== 'preview.example' &&
      url.hostname !== '127.0.0.1' &&
      !/^(?:[^.]+\.)?localconverter\.pages\.dev$/.test(url.hostname)
    )
      return route.abort('blockedbyclient');
    let name = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    if (!extname(name)) name += '.html';
    const file = resolve(root, name);
    if (
      dirname(file) !== root &&
      !file.startsWith(root + '/assets/') &&
      !file.startsWith(root + '\\assets\\')
    )
      return route.abort();
    let body,
      status = 200;
    try {
      body = await readFile(file);
    } catch {
      body = await readFile(join(root, '404.html'));
      status = 404;
    }
    const types = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.woff2': 'font/woff2',
      '.webp': 'image/webp',
      '.png': 'image/png',
      '.svg': 'image/svg+xml',
      '.txt': 'text/plain; charset=utf-8',
      '.md': 'text/plain; charset=utf-8',
    };
    return route.fulfill({
      status,
      body,
      headers: {
        'content-type': types[extname(name)] || 'application/octet-stream',
        ...headersFor(url.href, rules),
      },
    });
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (event) =>
      window.__cspViolations.push({
        directive: event.effectiveDirective,
        blocked: event.blockedURI,
      }),
    );
  });
  return { context, page, requests, errors };
}

test('production-origin tag runs once under the generated CSP without sending test events to Google', async ({
  browser,
}) => {
  const { context, page, requests, errors } = await publicContext(browser);
  try {
    await page.goto('https://localconverter.tech/merge-pdf?secret=DO_NOT_SEND#DO_NOT_SEND');
    await expect.poll(() => page.evaluate(() => window.dataLayer?.length || 0)).toBe(2);
    const commands = await page.evaluate(() => window.dataLayer.map((args) => Array.from(args))),
      config = commands.find((args) => args[0] === 'config');
    expect(config[1]).toBe('G-PNZFZ75FT9');
    expect(config[2].page_location).toBe('https://localconverter.tech/merge-pdf');
    expect(JSON.stringify(commands)).not.toContain('DO_NOT_SEND');
    await expect(page.locator('head>script[src*="googletagmanager.com/gtag/js"]')).toHaveCount(1);
    await page.evaluate(() => {
      const script = document.createElement('script');
      script.textContent = document.getElementById('google-tag-config').textContent;
      document.head.append(script);
    });
    expect(
      await page.evaluate(() => window.dataLayer.filter((args) => args[0] === 'config').length),
    ).toBe(1);
    expect(requests.filter((url) => url.includes('googletagmanager.com/gtag/js'))).toHaveLength(1);
    expect(requests.some((url) => /google-analytics.com/.test(url))).toBe(false);
    expect(await page.evaluate(() => window.__cspViolations)).toEqual([]);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test('Pages hostname and deployment previews are noindex while the custom domain stays indexable', async ({
  browser,
}) => {
  const { context, page } = await publicContext(browser);
  try {
    for (const origin of [
      'https://localconverter.pages.dev',
      'https://abc123.localconverter.pages.dev',
      'https://staging.localconverter.pages.dev',
    ]) {
      for (const path of ['/', '/merge-pdf', '/robots.txt', '/missing-page']) {
        const response = await page.goto(origin + path),
          headers = await response.allHeaders();
        expect(headers['x-robots-tag']).toBe('noindex, follow');
        if (path === '/robots.txt') {
          expect(await response.text()).toContain('Allow: /');
          expect(await response.text()).not.toMatch(/^Disallow: \/$/m);
        }
      }
      expect(await page.evaluate(() => window.dataLayer?.length || 0)).toBe(0);
    }
    for (const path of ['/', '/merge-pdf']) {
      const response = await page.goto('https://localconverter.tech' + path);
      expect((await response.allHeaders())['x-robots-tag']).toBeUndefined();
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
    }
  } finally {
    await context.close();
  }
});
test('preview origins never initialize collection and text discovery is served with explicit noindex headers', async ({
  browser,
}) => {
  const { context, page, errors } = await publicContext(browser);
  try {
    for (const origin of ['http://127.0.0.1:3112', 'https://preview.example']) {
      await page.goto(origin + '/privacy');
      expect(await page.evaluate(() => window.dataLayer?.length || 0)).toBe(0);
      await expect(
        page.getByRole('heading', { name: 'Google Analytics on the public website', exact: true }),
      ).toBeVisible();
    }
    for (const path of ['/llms.txt', '/llms-full.txt', '/humans.txt', '/merge-pdf.md']) {
      const response = await page.goto('https://localconverter.tech' + path),
        headers = await response.allHeaders();
      expect(response.status()).toBe(200);
      expect(headers['content-type']).toContain('text/plain');
      expect(headers['x-robots-tag']).toBe('noindex');
    }
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
