import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { exportBrowserSite } from '../scripts/export-browser-site.mjs';

test('public browser export retains the original app scripts and supplies real browser routes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lc-browser-export-')),
    app = join(root, 'app'),
    output = join(root, 'site');
  try {
    await mkdir(join(app, 'assets'), { recursive: true });
    await writeFile(join(app, 'assets', 'app.js'), 'console.log("original app")');
    await writeFile(
      join(app, 'index.html'),
      '<!doctype html><html><head><meta charset="UTF-8"><title>App</title><meta name="description" content="old"></head><body><div id="root"></div><script type="module" src="/assets/app.js"></script></body></html>',
    );
    const result = await exportBrowserSite({ appDirectory: app, output });
    assert.ok(result.paths.length > 300);
    for (const route of ['/', '/tools', '/generate-id', '/merge-pdf', '/mp4-to-mp3']) {
      const html = await readFile(
        join(output, route === '/' ? 'index.html' : route.slice(1) + '.html'),
        'utf8',
      );
      assert.match(html, /type="module" src="\/assets\/app.js"/);
      assert.match(html, /id="root"/);
      assert.match(html, /"mode":"browser"/);
      assert.doesNotMatch(
        html,
        /This public page does not accept files|Guide for the installed local app/,
      );
      assert.equal((html.match(/<title>/g) || []).length, 1);
      assert.match(html, /name="robots" content="index, follow"/);
    }
    const header = await readFile(join(output, '_headers'), 'utf8');
    assert.match(header, /https:\/\/localconverter\.pages\.dev\/\*/);
    assert.match(header, /worker-src 'self' blob:/);
    assert.match(header, /'wasm-unsafe-eval'/);
    assert.match(await readFile(join(output, 'llms.txt'), 'utf8'), /browser/i);
    assert.doesNotMatch(
      await readFile(join(output, 'llms.txt'), 'utf8'),
      /requires Node\.js|does not accept uploads/,
    );
    await access(join(output, 'assets/app.js'));
    await writeFile(join(output, 'obsolete.html'), 'old');
    await exportBrowserSite({ appDirectory: app, output });
    await assert.rejects(access(join(output, 'obsolete.html')));
    await assert.rejects(
      exportBrowserSite({ appDirectory: app, output: resolve('.') }),
      /source|directory|output/i,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
