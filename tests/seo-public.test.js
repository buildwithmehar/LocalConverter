import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, access, readdir, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { exportPublicGuides } from '../scripts/export-public-guides.mjs';

test('public export contains only readable guides and assets, with a closed crawl graph', async () => {
  const output = await mkdtemp(join(tmpdir(), 'lc-public-seo-'));
  try {
    const { paths } = await exportPublicGuides({ output }),
      known = new Set(paths),
      titles = new Set(),
      descriptions = new Set();
    assert.ok(paths.length > 300);
    const edges = new Map();
    for (const route of paths) {
      const html = await readFile(
        join(output, route === '/' ? 'index.html' : route.slice(1) + '.html'),
        'utf8',
      );
      assert.equal((html.match(/<h1>/g) || []).length, 1, route);
      assert.ok(html.includes(`href="https://localconverter.tech${route}"`), route);
      assert.match(html, /name="robots" content="index, follow"/);
      assert.match(html, /This public page does not accept files/);
      assert.ok(!html.match(/local-bootstrap|\/api\/|type="module"|\/tool-runtime\//), route);
      assert.ok(!html.includes('Enable JavaScript to use'), route);
      const title = html.match(/<title>(.*?)<\/title>/)[1],
        description = html.match(/name="description" content="([^"]+)"/)[1];
      assert.ok(!titles.has(title), 'Duplicate title ' + route);
      titles.add(title);
      assert.ok(!descriptions.has(description), 'Duplicate description ' + route);
      descriptions.add(description);
      for (const match of html.matchAll(/<a[^>]+href="(\/[^"#?]*)"/g))
        assert.ok(known.has(match[1]), `Broken internal link on ${route}: ${match[1]}`);
      edges.set(
        route,
        [...html.matchAll(/<a[^>]+href="(\/[^"#?]*)"/g)].map((match) => match[1]),
      );
      for (const match of html.matchAll(
        /(?:href|src)="(\/(?:assets\/[^"?]+|theme-init.js|favicon.svg))"/g,
      ))
        await access(join(output, match[1].slice(1)));
    }
    const reachable = new Set(['/']),
      queue = ['/'];
    while (queue.length)
      for (const route of edges.get(queue.shift()) || [])
        if (!reachable.has(route)) {
          reachable.add(route);
          queue.push(route);
        }
    assert.deepEqual(
      paths.filter((path) => !reachable.has(path)),
      [],
      'Orphan public pages',
    );
    assert.ok(!(await readdir(join(output, 'assets'))).some((name) => /\.(js|wasm)$/.test(name)));
    await assert.rejects(access(join(output, 'api')));
    assert.match(await readFile(join(output, '404.html'), 'utf8'), /noindex, follow/);
    assert.match(
      await readFile(join(output, 'robots.txt'), 'utf8'),
      /Sitemap: https:\/\/localconverter.tech\/sitemap.xml/,
    );
    const headers = await readFile(join(output, '_headers'), 'utf8');
    assert.match(
      headers,
      /https:\/\/localconverter\.pages\.dev\/\*\r?\n  X-Robots-Tag: noindex, follow/,
    );
    assert.match(
      headers,
      /https:\/\/:deployment\.localconverter\.pages\.dev\/\*\r?\n  X-Robots-Tag: noindex, follow/,
    );
    assert.doesNotMatch(
      headers,
      /^\/\*\r?\n  X-Robots-Tag: noindex/m,
      'Main domain must remain indexable',
    );
    assert.doesNotMatch(
      await readFile(join(output, 'robots.txt'), 'utf8'),
      /^Disallow: \/$/m,
      'Crawlers must be able to read the noindex response',
    );
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});

test('re-export removes obsolete output while refusing unrelated or source directories', async () => {
  const output = await mkdtemp(join(tmpdir(), 'lc-public-rebuild-')),
    unmanaged = await mkdtemp(join(tmpdir(), 'lc-unmanaged-'));
  try {
    await exportPublicGuides({ output });
    await mkdir(join(output, 'removed-tool'), { recursive: true });
    await writeFile(join(output, 'removed-tool', 'index.html'), 'obsolete');
    await writeFile(join(output, 'assets', 'old-hash.css'), 'obsolete');
    await exportPublicGuides({ output });
    await assert.rejects(access(join(output, 'removed-tool')));
    await assert.rejects(access(join(output, 'assets', 'old-hash.css')));
    await writeFile(join(unmanaged, 'keep.txt'), 'Keep this user file.');
    await assert.rejects(exportPublicGuides({ output: unmanaged }), /unmanaged|owned/i);
    assert.equal(await readFile(join(unmanaged, 'keep.txt'), 'utf8'), 'Keep this user file.');
    await assert.rejects(exportPublicGuides({ output: resolve('.') }), /output|source|directory/i);
  } finally {
    await rm(output, { recursive: true, force: true });
    await rm(unmanaged, { recursive: true, force: true });
  }
});
