import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { JSDOM } from 'jsdom';
import { exportPublicGuides } from '../scripts/export-public-guides.mjs';
import { getRegistry } from '../server/conversion/registry.js';
import { operationPages } from '../server/page-content.js';
import { siteSettings, metadataFor, renderPage } from '../server/page-seo.js';
let output, paths;
const file = (route) => (route === '/' ? 'index.html' : route.slice(1) + '.html');
before(async () => {
  output = await mkdtemp(join(tmpdir(), 'lc-public-analytics-'));
  ({ paths } = await exportPublicGuides({ output }));
});
after(async () => {
  await rm(output, { recursive: true, force: true });
});

test('each public HTML page has exactly one Google tag and one initializer at the start of head', async () => {
  for (const route of [...paths, '/404']) {
    const html = await readFile(join(output, file(route)), 'utf8'),
      doc = new JSDOM(html).window.document;
    const scripts = doc.querySelectorAll('script[src*="googletagmanager.com/gtag/js"]');
    assert.equal(scripts.length, 1, route);
    assert.equal(doc.head.firstElementChild, scripts[0], route);
    assert.equal(new URL(scripts[0].src).searchParams.get('id'), 'G-PNZFZ75FT9');
    assert.equal(doc.querySelectorAll('#google-tag-config').length, 1, route);
    assert.ok(html.indexOf('<meta charset="UTF-8">') < 1024, route);
  }
});
test('analytics initializes once with safe page data and stays off previews or unrelated origins', async () => {
  const html = await readFile(join(output, 'merge-pdf.html'), 'utf8');
  for (const url of [
    'https://localconverter.tech/merge-pdf?secret=PRIVATE#PRIVATE',
    'http://127.0.0.1:3112/merge-pdf',
    'https://preview.example/merge-pdf',
    'http://localconverter.tech/merge-pdf',
  ]) {
    const dom = new JSDOM(html, {
        url,
        referrer: 'https://search.example/private/filename.pdf?token=PRIVATE',
        runScripts: 'outside-only',
      }),
      window = dom.window;
    const code = window.document.querySelector('#google-tag-config')?.textContent;
    assert.ok(code, 'Missing analytics initializer');
    window.eval(code);
    window.eval(code);
    window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
    window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
    const commands = Array.from(window.dataLayer || [], (args) => Array.from(args)),
      configs = commands.filter((args) => args[0] === 'config');
    if (new URL(url).origin === 'https://localconverter.tech') {
      assert.equal(configs.length, 1);
      assert.equal(configs[0][1], 'G-PNZFZ75FT9');
      assert.equal(configs[0][2].page_location, 'https://localconverter.tech/merge-pdf');
      assert.equal(configs[0][2].page_referrer, 'https://search.example/');
      assert.equal(configs[0][2].page_title, 'Merge PDF — Local Converter');
      assert.equal(configs[0][2].allow_google_signals, false);
      assert.equal(configs[0][2].allow_ad_personalization_signals, false);
      assert.ok(!JSON.stringify(commands).includes('PRIVATE'));
    } else assert.equal(configs.length, 0, url);
    dom.window.close();
  }
});
test('CSP authorizes the actual inline tag by hash and permits Analytics without broad inline script access', async () => {
  const html = await readFile(join(output, 'index.html'), 'utf8'),
    doc = new JSDOM(html).window.document,
    code = doc.querySelector('#google-tag-config')?.textContent;
  assert.ok(code);
  const hash = createHash('sha256').update(code).digest('base64'),
    headers = await readFile(join(output, '_headers'), 'utf8');
  assert.ok(headers.includes(`'sha256-${hash}'`));
  assert.match(headers, /script-src[^;]*https:\/\/www.googletagmanager.com/);
  assert.doesNotMatch(headers, /script-src[^;]*'unsafe-inline'/);
  assert.match(headers, /connect-src[^;]*google-analytics.com/);
  assert.match(headers, /\/llms-full.txt[\s\S]*X-Robots-Tag: noindex/);
});
test('discovery files and Markdown describe the real site and link only to generated public resources', async () => {
  const robots = await readFile(join(output, 'robots.txt'), 'utf8');
  assert.match(robots, /User-agent: \*\nAllow: \/\n/);
  for (const path of [
    '/api/',
    '/activity',
    '/errors',
    '/.export-owner.json',
    '/build-manifest.json',
  ])
    assert.ok(robots.includes('Disallow: ' + path));
  assert.match(robots, /Sitemap: https:\/\/localconverter.tech\/sitemap.xml/);
  assert.doesNotMatch(robots, /Disallow: \/\s*\n/);
  const index = await readFile(join(output, 'llms.txt'), 'utf8'),
    full = await readFile(join(output, 'llms-full.txt'), 'utf8'),
    humans = await readFile(join(output, 'humans.txt'), 'utf8');
  assert.match(index, /^# Local Converter\n\n> /);
  assert.ok(index.length < 16000);
  assert.match(index, /installed local app/i);
  assert.match(humans, /localconverter.tech/);
  for (const resource of ['llms.txt', 'llms-full.txt', 'humans.txt']) {
    const text = await readFile(join(output, resource), 'utf8');
    assert.doesNotMatch(
      text,
      /C:\\Users|\.local-data|\/api\/jobs|lc_session|x-local-token|top.rank|guaranteed ranking/i,
    );
  }
  for (const match of index.matchAll(/\]\((https:\/\/localconverter\.tech\/[^)#?]*)\)/g))
    await readFile(join(output, new URL(match[1]).pathname.slice(1)), 'utf8');
  for (const route of paths) {
    const mdFile = route === '/' ? 'index.md' : route.slice(1) + '.md',
      markdown = await readFile(join(output, mdFile), 'utf8');
    assert.match(markdown, /^# /);
    assert.ok(full.includes('Source: https://localconverter.tech' + route), route);
    const html = await readFile(join(output, file(route)), 'utf8');
    assert.ok(html.includes(`type="text/markdown" href="/${mdFile}"`));
    assert.ok(html.includes('rel="describedby" href="/llms.txt"'));
  }
  const privacy = await readFile(join(output, 'privacy.html'), 'utf8');
  assert.match(privacy, /Google Analytics/);
  assert.match(privacy, /G-PNZFZ75FT9/);
});
test('private app HTML contains no Analytics and retains private indexing policy', async () => {
  const registry = await getRegistry(),
    page = operationPages(registry).get('/merge-pdf'),
    site = siteSettings({ siteUrl: 'http://127.0.0.1:3000' });
  const html = renderPage('<html><head></head><body><div id="root"></div></body></html>', {
    page,
    meta: metadataFor(page.path, page, site, registry),
    registry,
    site,
  });
  assert.doesNotMatch(html, /googletagmanager|google-analytics|G-PNZFZ75FT9/);
  assert.match(html, /noindex, follow/);
});
