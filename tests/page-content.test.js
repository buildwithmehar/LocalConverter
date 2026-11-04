import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { getRegistry } from '../server/conversion/registry.js';
import { operationPages } from '../server/page-content.js';
import { metadataFor, siteSettings, renderPage, sitemap } from '../server/page-seo.js';
import { createApp } from '../server/app.js';
let registry, pages, instance, dir;
before(async () => {
  registry = {
    ...(await getRegistry()),
    limits: { maxFiles: 20, maxBytes: 104857600, timeoutSeconds: 180, retentionMinutes: 30 },
  };
  pages = operationPages(registry);
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lc-page-content-'));
  instance = await createApp({ dataRoot: dir, port: 3000 });
});
after(async () => {
  await instance?.close();
  await fs.rm(dir, { recursive: true, force: true });
});
const host = (req) => req.set('Host', '127.0.0.1:3000');
const textParts = (value) =>
  typeof value === 'string'
    ? value
    : Array.isArray(value)
      ? value.map(textParts).join(' ')
      : value && typeof value === 'object'
        ? Object.values(value).map(textParts).join(' ')
        : '';

test('every one of 240 operations has substantial, specific instructions, settings, example and FAQs', () => {
  assert.equal(pages.size, registry.tools.length + registry.pairs.length);
  assert.equal(pages.size, registry.tools.length + registry.pairs.length);
  const titles = new Set(),
    descriptions = new Set();
  let shortest = Infinity;
  for (const [route, page] of pages) {
    assert.equal(page.path, route);
    assert.ok(page.title);
    assert.equal(page.steps.length, 4, route);
    assert.equal(page.useCases.length, 3, route);
    assert.ok(page.faqs.length >= 6, route);
    assert.ok(page.example.title && page.example.text, route);
    assert.ok(page.review.length > 50, route);
    assert.ok(page.limitations.length >= 2, route);
    const words = textParts({
      lead: page.lead,
      steps: page.steps,
      useCases: page.useCases,
      example: page.example,
      review: page.review,
      settings: page.settings,
      limitations: page.limitations,
      faqs: page.faqs,
    }).split(/\s+/).length;
    shortest = Math.min(shortest, words);
    assert.ok(words >= 400, `${route}: ${words} words`);
    assert.ok(page.description.length >= 80 && page.description.length <= 200, route);
    assert.ok(!titles.has(page.title), 'Duplicate title ' + route);
    assert.ok(!descriptions.has(page.description), 'Duplicate description ' + route);
    titles.add(page.title);
    descriptions.add(page.description);
    for (const item of page.related) {
      assert.notEqual(item.path, route);
      assert.ok(pages.has(item.path), 'Broken related tool ' + item.path);
    }
  }
  console.log(`All operation routes covered; shortest guide ${shortest} words.`);
});
test('all operation URLs return their own raw HTML content and unique canonical metadata', async () => {
  for (const [route, page] of pages) {
    const response = await host(request(instance.app).get(route))
      .expect(200)
      .expect('Content-Type', /html/);
    const html = response.text;
    assert.equal((html.match(/<title>/g) || []).length, 1, route);
    assert.equal((html.match(/name="description"/g) || []).length, 1, route);
    assert.equal((html.match(/<h1>/g) || []).length, 1, route);
    assert.ok(html.includes(`data-page-guide="${route}"`), route);
    assert.ok(html.includes('id="guide-how-to"'), route);
    assert.ok(html.includes('id="guide-faq"'), route);
    assert.ok(html.includes(`href="http://127.0.0.1:3000${route}"`), route);
    const schema = JSON.parse(
      html.match(/<script id="page-schema" type="application\/ld\+json">([\s\S]*?)<\/script>/)[1],
    );
    assert.equal(schema['@graph'][0].name, page.title);
    assert.ok(schema['@graph'].some((item) => item['@type'] === 'BreadcrumbList'));
    assert.ok(!html.includes('aggregateRating'));
    const boot = JSON.parse(
      html.match(/<script id="local-bootstrap" type="application\/json">([\s\S]*?)<\/script>/)[1],
    );
    assert.equal(boot.page.path, route);
  }
});
test('public guide endpoint and sitemap cover actual operations while private localhost stays unindexed', async () => {
  const response = await host(request(instance.app).get('/api/pages/icon-favicon')).expect(200);
  assert.equal(response.body.title, 'ICO and favicon pack');
  assert.ok(response.body.faqs.length >= 6);
  assert.match(response.body.seo.robots, /noindex/);
  await host(request(instance.app).get('/api/pages/not-a-real-tool')).expect(404);
  const xml = (await host(request(instance.app).get('/sitemap.xml')).expect(200)).text;
  for (const route of pages.keys()) assert.ok(xml.includes('http://127.0.0.1:3000' + route), route);
  assert.ok(!xml.includes('/activity'));
  assert.match(
    (await host(request(instance.app).get('/robots.txt')).expect(200)).text,
    /Disallow: \//,
  );
  await host(request(instance.app).get('/not-a-real-page')).expect(404);
  await host(request(instance.app).get('/notreal-converter')).expect(404);
  await host(request(instance.app).get('/png-converter')).expect(200);
});
test('configured public origin is canonical and script-breaking input cannot escape static HTML or bootstrap', () => {
  const site = siteSettings({ siteUrl: 'https://example.com' }),
    page = { ...pages.get('/icon-favicon'), lead: '</script><img src=x onerror=alert(1)> & "' };
  const meta = metadataFor(page.path, page, site);
  assert.equal(meta.robots, 'index, follow');
  assert.equal(meta.canonical, 'https://example.com/icon-favicon');
  const html = renderPage(
    '<html><head><title>Old</title><meta name="description" content="Old"/></head><body><div id="root"></div></body></html>',
    { page, meta, registry, site },
  );
  assert.ok(!html.includes('<img src=x'));
  assert.match(html, /&lt;\/script&gt;/);
  const boot = JSON.parse(
    html.match(/id="local-bootstrap" type="application\/json">([\s\S]*?)<\/script>/)[1],
  );
  assert.equal(boot.page.lead, page.lead);
  const xml = sitemap(pages, site);
  assert.ok(xml.includes('https://example.com/icon-favicon'));
  assert.ok(!xml.includes('localhost'));
  for (const url of [
    'file:///tmp/a',
    'https://u:secret@example.com',
    'https://example.com/path',
    'https://example.com/?x=1',
  ])
    assert.throws(() => siteSettings({ siteUrl: url }));
});
