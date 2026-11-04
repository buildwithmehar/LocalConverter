import { readFile, writeFile, mkdir, readdir, cp, lstat, rm, stat } from 'node:fs/promises';
import { resolve, join, dirname, relative, isAbsolute, parse, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { browserRegistry } from '../src/browser/registry.js';
import { operationPages } from '../server/page-content.js';
import { headMarkup, staticGuide, staticDiscovery, sitemap } from '../server/page-seo.js';
import { metadataFor } from '../shared/seo-metadata.js';
import { discoveryPaths, discoveryPage, publicSiteOrigin } from '../shared/search-content.js';
import { browserOperation } from '../shared/browser-copy.js';
import { discoveryFiles, markdownPath } from '../shared/site-discovery.js';
import { publicAnalytics } from '../shared/public-analytics.js';

const project = resolve(import.meta.dirname, '..'),
  safeJson = (value) => JSON.stringify(value).replace(/</g, '\\u003c');
async function prepare(output, appDirectory) {
  output = resolve(output);
  const toSource = relative(output, project),
    within = relative(project, output);
  if (
    output === parse(output).root ||
    toSource === '' ||
    (!toSource.startsWith('..' + sep) && toSource !== '..' && !isAbsolute(toSource)) ||
    output === resolve(appDirectory)
  )
    throw new Error('Browser export output cannot replace a source directory or app build.');
  if (
    !within.startsWith('..') &&
    !isAbsolute(within) &&
    new Set([
      'src',
      'server',
      'shared',
      'public',
      'docs',
      'scripts',
      'tests',
      'node_modules',
      '.tools',
      '.local-data',
      'dist',
    ]).has(within.split(sep)[0])
  )
    throw new Error('Browser export output cannot replace source or runtime files.');
  const existing = await lstat(output).catch((error) => {
    if (error.code !== 'ENOENT') throw error;
  });
  if (existing && (!existing.isDirectory() || existing.isSymbolicLink()))
    throw new Error('Browser export output must be a real directory.');
  const entries = existing ? await readdir(output) : [];
  if (entries.length) {
    let owned = false;
    for (const marker of ['.export-owner.json', 'build-manifest.json'])
      try {
        const value = JSON.parse(await readFile(join(output, marker), 'utf8'));
        owned ||=
          value.owner === 'local-converter' || ['browser', 'public-guides'].includes(value.mode);
      } catch {}
    if (!owned) throw new Error('Refusing to replace an unmanaged browser export directory.');
    for (const name of entries) {
      const file = resolve(output, name);
      if (dirname(file) !== output) throw new Error('Unsafe browser export cleanup target.');
      await rm(file, { recursive: true, force: true });
    }
  }
  await mkdir(output, { recursive: true });
  return output;
}
export async function checkAssetSizes(folder) {
  const oversized = [];
  async function visit(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isSymbolicLink()) throw new Error('Linked files cannot be published.');
      if (entry.isDirectory()) await visit(path);
      else {
        const size = (await stat(path)).size;
        if (size > 25 * 1024 * 1024) oversized.push({ path: relative(folder, path), size });
      }
    }
  }
  await visit(folder);
  if (oversized.length)
    throw new Error('Cloudflare Pages asset exceeds 25 MiB: ' + JSON.stringify(oversized));
}
export async function exportBrowserSite({
  appDirectory = resolve(project, 'dist'),
  output = resolve(project, 'dist-public'),
  origin = publicSiteOrigin,
} = {}) {
  const url = new URL(origin);
  if (url.protocol !== 'https:' || url.origin !== origin)
    throw new Error('Browser website requires a public HTTPS origin.');
  const template = await readFile(join(appDirectory, 'index.html'), 'utf8');
  if (!/type="module"/.test(template))
    throw new Error('Build the original React app before exporting the browser website.');
  await checkAssetSizes(appDirectory);
  output = await prepare(output, appDirectory);
  await cp(appDirectory, output, { recursive: true });
  const registry = browserRegistry(),
    site = { origin, indexable: true, mode: 'browser' },
    pages = new Map(
      [...operationPages(registry)].map(([path, page]) => [path, browserOperation(page, registry)]),
    ),
    paths = [...new Set([...discoveryPaths(registry), ...pages.keys()])];
  const analytics = publicAnalytics(origin),
    hash = createHash('sha256').update(analytics.code).digest('base64');
  function html(route) {
    const page = pages.get(route),
      meta = metadataFor(route, page, site, registry),
      guide = page
        ? staticGuide(page).replace(
            'Enable JavaScript to use the installed local converter.',
            'Enable JavaScript to process files in this browser.',
          )
        : staticDiscovery(discoveryPage(route, registry));
    const fallback =
      guide +
      '<footer class="server-brand"><a href="/about">About Local Converter</a><a href="/privacy">Privacy</a><a href="/security">Security</a><a href="/terms">Terms of use</a><a href="/tools">All tools</a></footer>';
    const bootstrap = { page: page ? { ...page, seo: meta } : null, registry, site };
    return template
      .replace(/<title>[\s\S]*?<\/title>/i, '')
      .replace(/<meta\s+name=["']description["'][^>]*>/i, '')
      .replace(/<head>/i, `<head>${analytics.loader}`)
      .replace(/(<meta\s+charset=["']UTF-8["']\s*\/?>)/i, `$1${analytics.initializer}`)
      .replace(
        '</head>',
        headMarkup(meta) +
          `<link rel="alternate" type="text/markdown" href="${markdownPath(route)}"><link rel="describedby" href="/llms.txt"></head>`,
      )
      .replace(
        '<div id="root"></div>',
        `<div id="root">${fallback}</div><script id="local-bootstrap" type="application/json">${safeJson(bootstrap)}</script>`,
      );
  }
  for (const route of [...paths, '/activity', '/404'])
    await writeFile(
      join(output, route === '/' ? 'index.html' : route.slice(1) + '.html'),
      html(route),
    );
  await writeFile(join(output, 'sitemap.xml'), sitemap(pages, site, registry));
  for (const [name, content] of discoveryFiles(site, registry, pages))
    await writeFile(join(output, name), content);
  const csp = `default-src 'self'; script-src 'self' blob: 'wasm-unsafe-eval' 'sha256-${hash}' https://www.googletagmanager.com; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: https://www.googletagmanager.com https://*.google-analytics.com; media-src 'self' blob:; connect-src 'self' blob: https://www.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com https://*.google.com; font-src 'self' data:; frame-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'`;
  const hostHeaders = (await readFile(join(project, 'public/_headers'), 'utf8')).trim(),
    textHeaders = ['/llms.txt', '/llms-full.txt', '/humans.txt', '/*.md']
      .map(
        (path) => `${path}\n  X-Robots-Tag: noindex\n  Content-Type: text/plain; charset=utf-8\n`,
      )
      .join('');
  const validatorPolicy =
      "default-src 'none'; script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval'; connect-src 'self'; worker-src 'none'",
    workerHeaders =
      ['utility-worker', 'font-worker']
        .map(
          (name) =>
            `/assets/${name}-*.js\n  ! Content-Security-Policy\n  Content-Security-Policy: ${validatorPolicy}\n`,
        )
        .join('') +
      `/tool-runtime/raw/worker.js\n  ! Content-Security-Policy\n  Content-Security-Policy: default-src 'none'; script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval'; connect-src 'self'; worker-src 'self' blob:\n`;
  await writeFile(
    join(output, '_headers'),
    `${hostHeaders}\n\n/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Cross-Origin-Opener-Policy: same-origin\n  Cross-Origin-Embedder-Policy: credentialless\n  Content-Security-Policy: ${csp}\n${workerHeaders}/activity\n  X-Robots-Tag: noindex\n${textHeaders}`,
  );
  await writeFile(
    join(output, '_redirects'),
    [
      `https://www.${url.hostname}/* ${origin}/:splat 301`,
      ...paths.filter((path) => path !== '/').map((path) => `${path}/ ${path} 301`),
    ].join('\n') + '\n',
  );
  await writeFile(
    join(output, '.export-owner.json'),
    safeJson({ owner: 'local-converter', mode: 'browser', version: 1 }) + '\n',
  );
  await writeFile(
    join(output, 'build-manifest.json'),
    JSON.stringify(
      {
        owner: 'local-converter',
        mode: 'browser',
        origin,
        tools: registry.tools.length,
        pairs: registry.pairs.length,
        pages: paths.length,
        paths,
        analyticsId: analytics.id,
      },
      null,
      2,
    ) + '\n',
  );
  await checkAssetSizes(output);
  console.log(
    `Exported original interactive browser app: ${registry.tools.length} tools, ${registry.pairs.length} pairs, ${paths.length} pages to ${output}.`,
  );
  return { output, paths, registry };
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename))
  await exportBrowserSite();
