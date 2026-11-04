import { readFile, access, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
const root = resolve(process.argv[2] || 'dist-public'),
  manifest = JSON.parse(await readFile(join(root, 'build-manifest.json'), 'utf8')),
  failures = [],
  titles = new Set(),
  descriptions = new Set(),
  edges = new Map();
const check = (ok, message) => {
  if (!ok) failures.push(message);
};
for (const path of manifest.paths) {
  const html = await readFile(
      join(root, path === '/' ? 'index.html' : path.slice(1) + '.html'),
      'utf8',
    ),
    title = html.match(/<title>(.*?)<\/title>/)?.[1],
    description = html.match(/name="description" content="([^"]+)"/)?.[1],
    canonical = html.match(/rel="canonical" href="([^"]+)"/)?.[1];
  check(Boolean(title) && !titles.has(title), 'Missing/duplicate title ' + path);
  titles.add(title);
  check(
    Boolean(description) && !descriptions.has(description),
    'Missing/duplicate description ' + path,
  );
  descriptions.add(description);
  check(canonical === manifest.origin + path, 'Canonical mismatch ' + path);
  check((html.match(/<h1>/g) || []).length === 1, 'One H1 required ' + path);
  check((html.match(/<title>/g) || []).length === 1, 'Duplicate title tags ' + path);
  check(html.includes('name="robots" content="index, follow"'), 'HTML indexing ' + path);
  check(html.includes('type="module"'), 'Original React app missing ' + path);
  check(html.indexOf('charset="UTF-8"') < 1024, 'Early UTF8 declaration ' + path);
  check(
    !/Guide for the installed local app|This public page does not accept files|Local-server mode sends|server results expire|\d+-minute temporary retention/.test(
      html,
    ),
    'Stale local-server/guide-only instructions ' + path,
  );
  const schema = JSON.parse(
    html.match(/<script id="page-schema" type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1] ||
      'null',
  );
  check(
    Boolean(schema?.['@graph']?.some((item) => item['@type'] === 'WebSite')),
    'Website entity ' + path,
  );
  for (const item of schema?.['@graph'] || [])
    if (item['@type'] === 'WebApplication')
      check(
        !/installed|Node\.js|Windows/.test(
          item.browserRequirements + ' ' + item.operatingSystem + ' ' + item.softwareRequirements,
        ),
        'Browser application schema ' + path,
      );
  const links = [...html.matchAll(/<a[^>]+href="(\/[^"#?]*)"/g)].map((match) => match[1]);
  edges.set(path, links);
  for (const link of links)
    check(manifest.paths.includes(link), 'Broken crawl link ' + path + ' -> ' + link);
}
const reached = new Set(['/']),
  queue = ['/'];
while (queue.length) {
  for (const path of edges.get(queue.shift()) || [])
    if (!reached.has(path)) {
      reached.add(path);
      queue.push(path);
    }
}
check(reached.size === manifest.paths.length, 'Orphan public pages');
const sitemap = await readFile(join(root, 'sitemap.xml'), 'utf8'),
  locations = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
check(locations.length === manifest.paths.length, 'Sitemap count');
check(
  locations.every((url) => manifest.paths.includes(url.slice(manifest.origin.length))),
  'Sitemap noncanonical/private URLs',
);
const robots = await readFile(join(root, 'robots.txt'), 'utf8');
check(
  /User-agent: \*/.test(robots) && /Allow: \//.test(robots) && !/^Disallow: \/$/m.test(robots),
  'Crawl policy',
);
check(
  robots.includes('Sitemap: ' + manifest.origin + '/sitemap.xml'),
  'Absolute sitemap declaration',
);
for (const name of ['robots.txt', 'llms.txt', 'llms-full.txt', 'humans.txt', 'sitemap.xml']) {
  const bytes = await readFile(join(root, name));
  check(!bytes.subarray(0, 3).equals(Buffer.from([239, 187, 191])), 'Unexpected UTF8 BOM ' + name);
}
const llms = await readFile(join(root, 'llms.txt'), 'utf8');
check(/^# Local Converter/m.test(llms) && /browser/i.test(llms), 'LLM project identity');
for (const match of llms.matchAll(/\]\((https:\/\/localconverter\.tech\/[^)]+)\)/g))
  try {
    await access(join(root, new URL(match[1]).pathname));
  } catch {
    failures.push('Broken LLM resource ' + match[1]);
  }
const headers = await readFile(join(root, '_headers'), 'utf8');
check(
  headers.includes('https://localconverter.pages.dev/*\n  X-Robots-Tag: noindex, follow'),
  'Pages hostname noindex',
);
const report = {
  mode: manifest.mode,
  pages: manifest.paths.length,
  uniqueTitles: titles.size,
  uniqueDescriptions: descriptions.size,
  reachable: reached.size,
  sitemapUrls: locations.length,
  failures,
};
await mkdir('.artifacts/verification', { recursive: true });
await writeFile(
  '.artifacts/verification/browser-seo-audit.json',
  JSON.stringify(report, null, 2) + '\n',
);
console.log(JSON.stringify(report));
if (failures.length) process.exitCode = 1;
