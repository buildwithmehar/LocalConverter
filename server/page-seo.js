import { discoveryPage, discoveryPaths } from '../shared/search-content.js';
export { metadataFor } from '../shared/seo-metadata.js';
const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const json = (value) =>
  JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
export function siteSettings({ siteUrl, port = 3000 } = {}) {
  const url = new URL(siteUrl || process.env.SITE_URL || `http://127.0.0.1:${port}`);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw new Error('SITE_URL must be an HTTP(S) origin without credentials, query or path.');
  return {
    origin: url.origin,
    indexable: !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname),
  };
}
export function headMarkup(meta) {
  return `<title>${escapeHtml(meta.title)}</title><meta name="description" content="${escapeHtml(meta.description)}"/><link rel="canonical" href="${escapeHtml(meta.canonical)}"/><meta name="robots" content="${meta.robots}"/><meta property="og:type" content="website"/><meta property="og:locale" content="en_US"/><meta property="og:site_name" content="Local Converter"/><meta property="og:title" content="${escapeHtml(meta.title)}"/><meta property="og:description" content="${escapeHtml(meta.description)}"/><meta property="og:url" content="${escapeHtml(meta.canonical)}"/><meta property="og:image" content="${escapeHtml(meta.image)}"/><meta property="og:image:type" content="image/png"/><meta property="og:image:width" content="1200"/><meta property="og:image:height" content="630"/><meta property="og:image:alt" content="Local Converter — private file conversion on your device"/><meta name="twitter:image:alt" content="Local Converter — private file conversion on your device"/><meta name="twitter:card" content="summary_large_image"/><meta name="twitter:title" content="${escapeHtml(meta.title)}"/><meta name="twitter:description" content="${escapeHtml(meta.description)}"/><meta name="twitter:image" content="${escapeHtml(meta.image)}"/>${meta.schema ? `<script id="page-schema" type="application/ld+json">${json(meta.schema)}</script>` : ''}`;
}
export function staticGuide(page, { publicGuide = false } = {}) {
  const h = escapeHtml,
    section = (id, title, body) => `<section id="${id}"><h2>${h(title)}</h2>${body}</section>`,
    p = (text) => `<p>${h(text)}</p>`;
  return `<main class="server-operation" id="main">${publicGuide ? '' : '<noscript><p class="server-noscript">Enable JavaScript to use the installed local converter. You can still read the complete guide below.</p></noscript>'}<header class="server-brand"><a href="/">Local Converter</a><a href="/tools">All tools</a></header><section class="info-hero info-hero-centered"><div class="hero-artwork hero-artwork-image" aria-hidden="true"></div><h1>${h(page.title)}</h1><p>${h(page.description)}</p></section><div class="operation-guide" data-page-guide="${h(page.path)}"><nav class="guide-contents" aria-label="On this page"><a href="#guide-how-to">How to use</a><a href="#guide-settings">Settings</a><a href="#guide-faq">FAQs</a></nav><section class="guide-overview"><span class="home-eyebrow">A practical guide</span><h2>${h(page.shortTitle)}</h2>${p(page.lead)}<ul>${page.useCases.map((item) => `<li>${h(item)}</li>`).join('')}</ul></section>${section('guide-how-to', `How to use ${page.shortTitle}`, `<ol class="guide-steps">${page.steps.map((step) => `<li><h3>${h(step.title)}</h3>${p(step.text)}</li>`).join('')}</ol>`)}${section('guide-settings', 'Understand the settings', page.settings.length ? `<dl class="guide-settings">${page.settings.map((setting) => `<div><dt>${h(setting.label)}</dt><dd>${h(setting.text)}</dd></div>`).join('')}</dl>` : p('This operation uses fixed output settings. Choose and order the supported files as described above, then review the output notes.'))}${section('guide-example', page.example.title, p(page.example.text))}${section('guide-check', 'Check your result', p(page.review))}${page.formats ? section('guide-formats', 'Source and output formats', page.formats.map((format) => `<h3>${h(format.label)}</h3>${p(format.text)}`).join('')) : ''}${section('guide-limits', 'What to know before you start', `<ul>${page.limitations.map((item) => `<li>${h(item)}</li>`).join('')}</ul>`)}${section('guide-faq', `${page.shortTitle}: common questions`, page.faqs.map((faq) => `<details><summary>${h(faq.question)}</summary>${p(faq.answer)}</details>`).join(''))}<nav class="guide-related" aria-label="Related tools">${page.related.map((item) => `<a href="${h(item.path)}">${h(item.title)}</a>`).join('')}</nav></div></main>`;
}
export function renderPage(template, { page, meta, registry, site }) {
  const head = template
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(/<meta\s+name=["']description["'][^>]*>/i, '')
    .replace('</head>', headMarkup(meta) + '</head>');
  const bootstrap = { page: page ? { ...page, seo: meta } : null, registry, site };
  return head.replace(
    '<div id="root"></div>',
    `<div id="root">${page ? staticGuide(page) : staticDiscovery(discoveryPage(new URL(meta.canonical).pathname, registry))}</div><script id="local-bootstrap" type="application/json">${json(bootstrap)}</script>`,
  );
}
export function sitemap(pages, site, registry) {
  const paths = [
    ...new Set([
      ...(registry
        ? discoveryPaths(registry)
        : [
            '/',
            '/tools',
            '/formats',
            '/help',
            '/about',
            '/how-it-works',
            '/security',
            '/privacy',
            '/terms',
          ]),
      ...pages.keys(),
    ]),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((path) => `<url><loc>${escapeHtml(site.origin + path)}</loc></url>`).join('')}</urlset>`;
}

export function staticDiscovery(page) {
  if (!page)
    return '<main id="main"><h1>Page not found</h1><p>Choose a supported converter from the <a href="/tools">tools directory</a>.</p></main>';
  const h = escapeHtml;
  return `<main id="main" class="server-operation"><header class="server-brand"><a href="/">Local Converter</a><a href="/tools">All tools</a><a href="/formats">Formats</a></header><section class="info-hero info-hero-centered"><div class="hero-artwork hero-artwork-image" aria-hidden="true"></div><h1>${h(page.title)}</h1><p>${h(page.description)}</p></section>${staticSearchGuide(page)}</main>`;
}
export function staticSearchGuide(page) {
  const h = escapeHtml;
  return `<article class="search-guide info-content" data-search-guide="${h(page.path)}"><p>${h(page.lead)}</p>${page.sections.map((section) => `<section><h2>${h(section.title)}</h2><p>${h(section.text)}</p></section>`).join('')}${page.groups.map((group) => `<section><h2>${h(group.title)}</h2><ul class="search-guide-links">${group.items.map((item) => `<li><a href="${h(item.path)}">${h(item.title)}</a></li>`).join('')}</ul></section>`).join('')}${page.faqs.length ? `<section><h2>Common questions</h2>${page.faqs.map((faq) => `<details><summary>${h(faq.question)}</summary><p>${h(faq.answer)}</p></details>`).join('')}</section>` : ''}<nav aria-label="Keep reading">${page.links.map((item) => `<a href="${h(item.path)}">${h(item.title)}</a>`).join('')}</nav></article>`;
}
