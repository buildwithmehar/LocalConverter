import { readFile, writeFile, mkdir, readdir, copyFile, lstat, rm } from 'node:fs/promises';
import { resolve, join, dirname, relative, isAbsolute, parse, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { getRegistry } from '../server/conversion/registry.js';
import { operationPages } from '../server/page-content.js';
import {
  siteSettings,
  metadataFor,
  headMarkup,
  staticGuide,
  staticDiscovery,
  sitemap,
} from '../server/page-seo.js';
import { discoveryPage, discoveryPaths, publicSiteOrigin } from '../shared/search-content.js';
import { publicAnalytics } from '../shared/public-analytics.js';
import { discoveryFiles, markdownPath } from '../shared/site-discovery.js';

// A public documentation site, never an exposed conversion server or job store.
const projectRoot = resolve(fileURLToPath(new URL('../', import.meta.url)));
async function prepareExportDirectory(requested) {
  const output = resolve(requested),
    toProject = relative(output, projectRoot),
    withinProject = relative(projectRoot, output);
  if (
    output === parse(output).root ||
    toProject === '' ||
    (!toProject.startsWith('..' + sep) && toProject !== '..' && !isAbsolute(toProject))
  )
    throw new Error('Export output cannot be the source directory or its ancestor.');
  const reserved = new Set([
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
    'work',
  ]);
  if (
    !withinProject.startsWith('..') &&
    !isAbsolute(withinProject) &&
    reserved.has(withinProject.split(sep)[0])
  )
    throw new Error('Export output cannot replace a source or runtime directory.');
  let stat;
  try {
    stat = await lstat(output);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (stat && (!stat.isDirectory() || stat.isSymbolicLink()))
    throw new Error('Export output must be a real directory, not a symlink or file.');
  const entries = stat ? await readdir(output) : [];
  if (entries.length) {
    let owned = false;
    for (const marker of ['.export-owner.json', 'build-manifest.json']) {
      try {
        const value = JSON.parse(await readFile(join(output, marker), 'utf8'));
        owned ||=
          value.mode === 'public-guides' &&
          (value.owner === 'local-converter' || Array.isArray(value.paths));
      } catch {}
    }
    if (!owned)
      throw new Error(
        'Refusing to replace an unmanaged export directory. Use an empty directory or an owned public guide export.',
      );
    // Delete only immediate children of the verified, owned output. Never compute shell deletion commands.
    for (const entry of entries) {
      const target = resolve(output, entry);
      if (dirname(target) !== output) throw new Error('Invalid export cleanup target.');
      await rm(target, { recursive: true, force: true });
    }
  }
  await mkdir(output, { recursive: true });
  await writeFile(
    join(output, '.export-owner.json'),
    JSON.stringify({ owner: 'local-converter', mode: 'public-guides', version: 1 }) + '\n',
  );
  return output;
}
export async function exportPublicGuides({
  output = resolve('dist-public'),
  origin = publicSiteOrigin,
} = {}) {
  const site = { ...siteSettings({ siteUrl: origin }), mode: 'public-guides' };
  if (!site.indexable || !site.origin.startsWith('https:'))
    throw new Error('Public guides require a public HTTPS origin.');
  const analytics = publicAnalytics(site.origin),
    inlineHash = createHash('sha256').update(analytics.code).digest('base64');
  const registry = await getRegistry(),
    pages = operationPages(registry),
    paths = [...discoveryPaths(registry), ...pages.keys()];
  const template = await readFile(resolve('dist/index.html'), 'utf8');
  const styles = [...template.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g)]
    .map((match) => match[0])
    .join('');
  output = await prepareExportDirectory(output);
  await mkdir(join(output, 'assets'), { recursive: true });
  for (const name of await readdir(resolve('dist/assets')))
    if (/\.(css|woff2?|webp|png|svg|jpe?g|avif)$/.test(name))
      await copyFile(resolve('dist/assets', name), join(output, 'assets', name));
  for (const name of [
    'favicon.ico',
    'favicon.svg',
    'favicon-96x96.png',
    'apple-touch-icon.png',
    'social-card.png',
    'theme-init.js',
  ])
    await copyFile(resolve('public', name), join(output, name));
  const notice =
    '<aside class="public-guide-notice" aria-label="Local installation required"><strong>Guide for the installed local app.</strong> Conversion runs on your computer after setup. This public page does not accept files. <a href="/how-it-works">Read the local workflow and setup requirements</a>.</aside>';
  for (const path of paths) {
    const page = pages.get(path),
      meta = metadataFor(path, page, site, registry);
    const content = page
      ? staticGuide(page, { publicGuide: true })
      : staticDiscovery(discoveryPage(path, registry, { publicSite: true }));
    const discovery = `<link rel="describedby" href="/llms.txt"><link rel="alternate" type="text/markdown" href="${markdownPath(path)}">`;
    const html = `<!doctype html><html lang="en"><head>${analytics.loader}<meta charset="UTF-8">${analytics.initializer}<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#18191d"><link rel="icon" href="/favicon.svg"><script src="/theme-init.js"></script>${styles}${headMarkup(meta)}${discovery}</head><body>${notice}${content}<footer class="server-brand"><a href="/about">About Local Converter</a><a href="/privacy">Privacy and Analytics</a><a href="/security">Security</a><a href="/terms">Terms of use</a><a href="/tools">Tools directory</a></footer></body></html>`;
    const file = join(output, path === '/' ? 'index.html' : path.slice(1) + '.html');
    await writeFile(file, html);
  }
  await writeFile(join(output, 'sitemap.xml'), sitemap(pages, site, registry));
  for (const [name, content] of discoveryFiles(site, registry, pages))
    await writeFile(join(output, name), content);
  const missing = metadataFor('/404', null, site, registry);
  await writeFile(
    join(output, '404.html'),
    `<!doctype html><html lang="en"><head>${analytics.loader}<meta charset="UTF-8">${analytics.initializer}<meta name="viewport" content="width=device-width,initial-scale=1">${styles}${headMarkup(missing)}</head><body>${staticDiscovery(null)}</body></html>`,
  );
  const csp = `default-src 'self'; script-src 'self' 'sha256-${inlineHash}' https://www.googletagmanager.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://www.googletagmanager.com https://*.google-analytics.com; connect-src 'self' https://www.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com https://*.google.com; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'`;
  const textHeaders = ['/llms.txt', '/llms-full.txt', '/humans.txt', '/*.md']
    .map((path) => `${path}\n  X-Robots-Tag: noindex\n  Content-Type: text/plain; charset=utf-8\n`)
    .join('');
  const hostHeaders = await readFile(resolve('public/_headers'), 'utf8');
  await writeFile(
    join(output, '_headers'),
    `${hostHeaders.trim()}\n\n/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Content-Security-Policy: ${csp}\n${textHeaders}`,
  );
  const hostname = new URL(site.origin).hostname,
    redirects = [
      ...(!hostname.startsWith('www.')
        ? [`https://www.${hostname}/* ${site.origin}/:splat 301`]
        : []),
      ...paths.filter((path) => path !== '/').map((path) => `${path}/ ${path} 301`),
    ];
  await writeFile(join(output, '_redirects'), redirects.join('\n') + '\n');
  await writeFile(
    join(output, 'build-manifest.json'),
    JSON.stringify(
      {
        origin: site.origin,
        mode: 'public-guides',
        layout: 'flat-html',
        analyticsId: analytics.id,
        discovery: ['robots.txt', 'llms.txt', 'llms-full.txt', 'humans.txt', 'sitemap.xml'],
        pages: paths.length,
        paths,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    `Exported ${paths.length} public guide pages for ${site.origin} to ${output}. Local conversion APIs and private jobs are excluded.`,
  );
  return { paths, output, origin: site.origin };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await exportPublicGuides();
