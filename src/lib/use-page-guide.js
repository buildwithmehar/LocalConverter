import { isBrowserSite } from '../browser/site-mode.js';
import { useEffect, useState } from 'react';
let bootstrap;
export function pageBootstrap() {
  if (bootstrap === undefined) {
    try {
      bootstrap = JSON.parse(document.getElementById('local-bootstrap')?.textContent || 'null');
      if (bootstrap?.site?.mode === 'browser' && location.origin !== bootstrap.site.origin) {
        bootstrap.site.indexable = false;
        if (bootstrap.page?.seo) bootstrap.page.seo.robots = 'noindex, follow';
      }
    } catch {
      bootstrap = null;
    }
  }
  return bootstrap;
}
const cached = new Map();
export function usePageGuide(route, enabled) {
  const first = pageBootstrap()?.page;
  if (first && !cached.has(first.path)) cached.set(first.path, first);
  const [page, setPage] = useState(() => cached.get(route) || null);
  useEffect(() => {
    if (!enabled) {
      setPage(null);
      return;
    }
    const found = cached.get(route);
    if (found) {
      setPage(found);
      return;
    }
    if (isBrowserSite()) {
      let active = true;
      setPage(null);
      import('../browser/guides.js').then(({ browserGuide }) => {
        const result = browserGuide(route);
        if (active && result) {
          cached.set(route, result);
          setPage(result);
        }
      });
      return () => {
        active = false;
      };
    }
    setPage(null);
    const controller = new AbortController();
    fetch(
      isBrowserSite()
        ? `/page-data/${encodeURIComponent(route.slice(1))}.json`
        : `/api/pages/${encodeURIComponent(route.slice(1))}`,
      { signal: controller.signal },
    )
      .then((response) => (response.ok ? response.json() : null))
      .then((result) => {
        if (result && !controller.signal.aborted) {
          cached.set(route, result);
          if (cached.size > 24) cached.delete(cached.keys().next().value);
          setPage(result);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [route, enabled]);
  return page?.path === route ? page : null;
}
export function applyPageMetadata(meta) {
  document.title = meta.title;
  const set = (selector, tag, attributes, value) => {
    let element = document.querySelector(selector);
    if (!element) {
      element = document.createElement(tag);
      for (const [key, val] of Object.entries(attributes)) element.setAttribute(key, val);
      document.head.append(element);
    }
    element.setAttribute(tag === 'link' ? 'href' : 'content', value);
  };
  set('meta[name="description"]', 'meta', { name: 'description' }, meta.description);
  set('link[rel="canonical"]', 'link', { rel: 'canonical' }, meta.canonical);
  set('meta[name="robots"]', 'meta', { name: 'robots' }, meta.robots);
  for (const [property, value] of Object.entries({
    'og:title': meta.title,
    'og:description': meta.description,
    'og:url': meta.canonical,
    'og:image': meta.image,
    'og:image:alt': 'Local Converter — private file conversion on your device',
    'og:image:type': 'image/png',
    'og:locale': 'en_US',
  }))
    if (value) set(`meta[property="${property}"]`, 'meta', { property }, value);
  for (const [name, value] of Object.entries({
    'twitter:card': 'summary_large_image',
    'twitter:title': meta.title,
    'twitter:description': meta.description,
    'twitter:image': meta.image,
    'twitter:image:alt': 'Local Converter — private file conversion on your device',
  }))
    if (value) set(`meta[name="${name}"]`, 'meta', { name }, value);
  let schema = document.getElementById('page-schema');
  if (meta.schema) {
    if (!schema) {
      schema = document.createElement('script');
      schema.id = 'page-schema';
      schema.type = 'application/ld+json';
      document.head.append(schema);
    }
    schema.textContent = JSON.stringify(meta.schema);
  } else schema?.remove();
}
