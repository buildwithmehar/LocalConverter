import { writeFile } from 'node:fs/promises';
import { getRegistry } from '../server/conversion/registry.js';
import { operationPages } from '../server/page-content.js';
import {
  discoveryPaths,
  discoveryPage,
  publicSiteOrigin,
  searchTitles,
} from '../shared/search-content.js';
import { metadataFor } from '../shared/seo-metadata.js';
const registry = await getRegistry(),
  pages = operationPages(registry),
  site = { origin: publicSiteOrigin, indexable: true };
const rows = [...discoveryPaths(registry), ...pages.keys()].map((path) => {
  const page = pages.get(path) || discoveryPage(path, registry),
    meta = metadataFor(path, pages.get(path), site, registry);
  return {
    path,
    url: meta.canonical,
    kind: page.kind,
    primaryTopic: searchTitles[path.slice(1)] || page.title,
    title: meta.title,
    description: meta.description,
  };
});
await writeFile(
  new URL('../docs/seo-audit/keyword-map.json', import.meta.url),
  JSON.stringify(
    {
      date: '2026-10-26',
      domain: publicSiteOrigin,
      method:
        'Qualitative mapping of observed competitor topics to actual supported operations; no keyword volume or ranking measurements.',
      pages: rows,
    },
    null,
    2,
  ) + '\n',
);
console.log(`Wrote ${rows.length} route/topic mappings.`);
