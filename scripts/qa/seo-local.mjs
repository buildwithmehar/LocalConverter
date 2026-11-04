import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
const auditRoot = resolve(process.argv[2] || '.artifacts/qa/local');
await mkdir(auditRoot, { recursive: true });
const origin = 'http://127.0.0.1:3000',
  xml = await (await fetch(origin + '/sitemap.xml')).text(),
  urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
const failures = [],
  titles = new Set(),
  descriptions = new Set();
let next = 0,
  checked = 0;
await Promise.all(
  Array.from({ length: 5 }, async () => {
    while (next < urls.length) {
      const url = urls[next++],
        response = await fetch(url),
        html = await response.text(),
        title = html.match(/<title>(.*?)<\/title>/)?.[1],
        description = html.match(/name="description" content="([^"]+)"/)?.[1],
        canonical = html.match(/rel="canonical" href="([^"]+)"/)?.[1];
      if (
        response.status !== 200 ||
        (html.match(/<h1>/g) || []).length !== 1 ||
        !title ||
        titles.has(title) ||
        !description ||
        descriptions.has(description) ||
        canonical !== url ||
        !html.includes('noindex, follow')
      )
        failures.push({ url, status: response.status, title, canonical });
      titles.add(title);
      descriptions.add(description);
      checked++;
    }
  }),
);
await writeFile(
  join(auditRoot, 'local-sitemap-qa.json'),
  JSON.stringify(
    {
      mode: 'Explicit application QA of known local routes, not an external searchbot crawl. Local robots remains Disallow: /.',
      origin,
      checked,
      uniqueTitles: titles.size,
      uniqueDescriptions: descriptions.size,
      failures,
    },
    null,
    2,
  ),
);
if (failures.length) throw new Error(JSON.stringify(failures));
console.log(
  `Validated ${checked} running local sitemap routes: 200, one H1, unique titles/descriptions, self-canonical, private noindex.`,
);
