import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getRegistry } from '../server/conversion/registry.js';
import { operationPages } from '../server/page-content.js';
import { metadataFor } from '../shared/seo-metadata.js';
import { discoveryPage } from '../shared/search-content.js';
import { convertDocument } from '../server/conversion/documents.js';

const registry = await getRegistry(),
  pages = operationPages(registry);
test('text extraction guides describe TXT output and representative conversions preserve readable words', async () => {
  for (const [source, input] of [
    ['md', '# Heading\n\nReadable **words**.'],
    ['html', '<h1>Heading</h1><p>Readable <strong>words</strong>.</p>'],
  ]) {
    const page = pages.get(`/${source}-to-txt`);
    assert.ok(page);
    assert.match(page.lead, /plain.text/i);
    assert.doesNotMatch(page.lead + page.review, /PDF creation|generated PDFs|Latin fonts/);
    const text = (await convertDocument(Buffer.from(input), source, 'txt')).toString();
    assert.match(text, /Heading/);
    assert.match(text, /Readable words/);
    assert.doesNotMatch(text, /<h1>|\*\*/);
  }
});
test('password guidance describes the HMAC key and the credential actually encoded in a Wi-Fi QR', () => {
  const hmac = pages.get('/hash-text').settings.find((s) => s.label === 'HMAC secret').text;
  const wifi = pages.get('/create-code').settings.find((s) => s.label === 'Wi-Fi password').text;
  assert.match(hmac, /HMAC/);
  assert.doesNotMatch(hmac, /document password/);
  assert.match(wifi, /encoded|contains/i);
  assert.doesNotMatch(wifi, /document password/);
});
test('browser mode answers distinguish local jobs from results lost on leaving the page', () => {
  for (const route of ['/compress-image', '/semantic-document']) {
    const page = pages.get(route),
      navigation = page.faqs.find((f) => f.question === 'Can I continue after changing pages?');
    assert.match(navigation.answer, /browser results.*not stored in My files/i);
    assert.match(navigation.answer, /before.*(?:leaving|navigat)/i);
    assert.match(
      page.faqs.find((f) => f.question.includes('upload files')).answer,
      /browser mode/i,
    );
  }
  for (const route of ['/generate-id', '/generate-password', '/placeholder-text']) {
    const page = pages.get(route),
      answer = page.faqs.find((f) => f.question === 'Which source should I use?').answer;
    assert.doesNotMatch(answer, /Supported file extensions|malformed content/);
    assert.match(answer, /no source file/i);
    assert.doesNotMatch(
      page.review + ' ' + page.example.text + ' ' + page.steps.map((step) => step.text).join(' '),
      /Enter or upload the source|UTF-8 text up to 1 MB/,
    );
  }
});
test('public documentation describes the local software while executable local pages retain application schema', () => {
  const page = pages.get('/compress-image'),
    site = { origin: 'https://localconverter.tech', indexable: true, mode: 'public-guides' };
  const graph = metadataFor(page.path, page, site, registry).schema['@graph'];
  assert.ok(graph[0].about);
  assert.ok(!graph.some((node) => node['@type'] === 'WebApplication'));
  assert.ok(
    graph.some(
      (node) =>
        node['@type'] === 'SoftwareApplication' && node['@id'] === site.origin + '/#software',
    ),
  );
  const local = metadataFor(
    page.path,
    page,
    { origin: 'http://127.0.0.1:3000', indexable: false },
    registry,
  );
  assert.ok(local.schema['@graph'].some((node) => node['@type'] === 'WebApplication'));
  assert.match(local.robots, /noindex/);
});
test('category answers are not repeated verbatim and home links to useful existing task pages', () => {
  for (const category of new Set(registry.formats.map((f) => f.category))) {
    const page = discoveryPage(`/${category}-converter`, registry);
    if (!page) continue;
    for (const section of page.sections)
      assert.ok(!page.faqs.some((faq) => faq.answer === section.text), category);
  }
  const home = discoveryPage('/', registry),
    paths = new Set(home.groups.flatMap((g) => g.items.map((item) => item.path)));
  for (const route of ['/compress-image', '/merge-pdf', '/create-code', '/decode-jwt'])
    assert.ok(paths.has(route), route);
});
