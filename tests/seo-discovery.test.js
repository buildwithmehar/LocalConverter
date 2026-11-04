import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { getRegistry } from '../server/conversion/registry.js';
import { operationPages } from '../server/page-content.js';
import { siteSettings, metadataFor, renderPage, sitemap } from '../server/page-seo.js';

const registry = await getRegistry(),
  pages = operationPages(registry),
  site = siteSettings({ siteUrl: 'https://localconverter.tech' });
const template = '<html><head><title>Old</title></head><body><div id="root"></div></body></html>';
const documentFor = (route) =>
  new JSDOM(
    renderPage(template, {
      page: pages.get(route),
      meta: metadataFor(route, pages.get(route), site, registry),
      registry,
      site,
    }),
  ).window.document;

test('discovery and trust pages have useful raw HTML, coherent schema and public metadata', () => {
  for (const route of [
    '/',
    '/tools',
    '/formats',
    '/image-converter',
    '/png-converter',
    '/to-png',
    '/about',
    '/privacy',
    '/security',
    '/help',
    '/how-it-works',
    '/terms',
  ]) {
    const doc = documentFor(route),
      meta = metadataFor(route, null, site, registry);
    assert.equal(doc.querySelectorAll('h1').length, 1, route);
    assert.ok(doc.querySelector('main').textContent.length > 250, route);
    assert.ok(doc.querySelectorAll('main a[href^="/"]').length >= 2, route);
    assert.equal(meta.robots, 'index, follow', route);
    assert.equal(
      doc.querySelector('meta[property="og:image"]').content,
      'https://localconverter.tech/social-card.png',
    );
    const graph = JSON.parse(doc.querySelector('#page-schema').textContent)['@graph'];
    assert.ok(
      graph.some((node) => node['@type'] === 'WebSite'),
      route,
    );
    assert.ok(!JSON.stringify(graph).match(/aggregateRating|FAQPage|HowTo|SearchAction/));
  }
});

test('home to tools is a crawlable path to every operation and all indexed hubs are in sitemap', () => {
  const home = documentFor('/'),
    tools = documentFor('/tools'),
    xml = sitemap(pages, site, registry);
  assert.ok(home.querySelector('a[href="/tools"]'));
  for (const route of pages.keys()) assert.ok(tools.querySelector(`a[href="${route}"]`), route);
  for (const route of ['/image-converter', '/png-converter', '/to-png'])
    assert.ok(xml.includes(`<loc>${site.origin}${route}</loc>`), route);
  assert.ok(!xml.match(/\/api\/|\/activity|\/errors/));
  assert.equal(metadataFor('/not-real', null, site, registry).robots, 'noindex, follow');
  assert.match(
    metadataFor('/', null, siteSettings({ siteUrl: 'http://localhost:3000' }), registry).robots,
    /noindex/,
  );
});

test('generator and text-tool guides describe their real inputs and byte limits', () => {
  const generator = pages.get('/generate-password'),
    text = pages.get('/count-text');
  assert.match(generator.facts.find((item) => item.label === 'Input').value, /no source/i);
  assert.ok(!generator.limitations.some((text) => /Upload one file/.test(text)));
  assert.match(text.limitations.join(' '), /UTF-8|MiB/);
  assert.ok(!text.limitations.join(' ').includes('one million characters'));
});
