import { operationPages } from '../../server/page-content.js';
import { metadataFor } from '../../shared/seo-metadata.js';
import { browserOperation } from '../../shared/browser-copy.js';
import { publicSiteOrigin } from '../../shared/search-content.js';
import { browserRegistry } from './registry.js';
let pages;
export function browserGuide(route) {
  const registry = browserRegistry();
  pages ||= operationPages(registry);
  const original = pages.get(route);
  if (!original) return null;
  const page = browserOperation(original, registry);
  const site = {
    origin: publicSiteOrigin,
    indexable: typeof location === 'undefined' || location.origin === publicSiteOrigin,
    mode: 'browser',
  };
  page.seo = metadataFor(route, page, site, registry);
  return page;
}
