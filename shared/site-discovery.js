import { discoveryPage, discoveryPaths, categoryContent } from './search-content.js';

export const discoveryFileNames = ['robots.txt', 'llms.txt', 'llms-full.txt', 'humans.txt'];
const privateSummary =
  '# Local Converter\n\nPrivate local application. This loopback service is not a public website. Crawling is disallowed by robots.txt. File selections and job data are not published.\n';
const label = (value) => String(value).replace(/[\\\[\]]/g, '\\$&');
export const markdownPath = (path) => (path === '/' ? '/index.md' : path + '.md');
const mdLink = (site, item) => `[${label(item.title)}](${site.origin + markdownPath(item.path)})`;

export function robotsText(site) {
  const lines = ['# Local Converter crawl policy', 'User-agent: *'];
  if (!site.indexable) lines.push('Disallow: /');
  else
    lines.push(
      'Allow: /',
      ...[
        '/api/',
        '/activity',
        '/errors',
        '/404',
        '/.git/',
        '/.local-data/',
        '/.tools/',
        '/node_modules/',
        '/work/',
        '/.export-owner.json',
        '/build-manifest.json',
      ].map((path) => 'Disallow: ' + path),
    );
  return lines.join('\n') + '\n\nSitemap: ' + site.origin + '/sitemap.xml\n';
}

export function guideMarkdown(path, site, registry, pages) {
  const page = pages.get(path) || discoveryPage(path, registry, { publicSite: true });
  if (!page) return null;
  const lines = [
    `# ${page.title}`,
    '',
    site.mode === 'browser'
      ? '> Browser-only file conversion. Selected files are processed on this device and are not uploaded to a conversion server.'
      : '> Documentation for the installed local app. This public page does not accept files or execute conversion.',
    '',
    `Source: ${site.origin + path}`,
    '',
    page.lead,
    '',
  ];
  if (page.kind === 'tool' || page.kind === 'converter') {
    lines.push(
      '## Useful tasks',
      '',
      ...page.useCases.map((text) => '- ' + text),
      '',
      '## Steps',
      '',
    );
    page.steps.forEach((step, index) =>
      lines.push(`${index + 1}. **${step.title}**: ${step.text}`),
    );
    lines.push(
      '',
      '## Settings',
      '',
      ...page.settings.map((setting) => `- **${setting.label}**: ${setting.text}`),
      '',
      `## ${page.example.title}`,
      '',
      page.example.text,
      '',
      '## Check the result',
      '',
      page.review,
      '',
    );
    if (page.formats)
      for (const format of page.formats) lines.push(`## ${format.label}`, '', format.text, '');
    lines.push(
      '## Limits',
      '',
      ...page.limitations.map((text) => '- ' + text),
      '',
      '## Questions',
      '',
    );
    for (const faq of page.faqs) lines.push(`### ${faq.question}`, '', faq.answer, '');
    lines.push(
      '## Related guides',
      '',
      ...page.related.map((item) => '- ' + mdLink(site, item)),
      '',
    );
  } else {
    for (const section of page.sections) lines.push(`## ${section.title}`, '', section.text, '');
    for (const group of page.groups)
      lines.push(
        `## ${group.title}`,
        '',
        ...group.items.map((item) => '- ' + mdLink(site, item)),
        '',
      );
    if (page.faqs.length) lines.push('## Questions', '');
    for (const faq of page.faqs) lines.push(`### ${faq.question}`, '', faq.answer, '');
    lines.push(
      '## Related information',
      '',
      ...page.links.map((item) => '- ' + mdLink(site, item)),
      '',
    );
  }
  return lines.join('\n').trim() + '\n';
}

export function llmsIndex(site, registry, pages) {
  if (!site.indexable) return privateSummary;
  const paths = new Set([...discoveryPaths(registry), ...pages.keys()]);
  const section = (title, items) => [
    '## ' + title,
    '',
    ...items.filter((item) => paths.has(item.path)).map((item) => '- ' + mdLink(site, item)),
    '',
  ];
  const info = [
    '/',
    '/tools',
    '/formats',
    '/how-it-works',
    '/help',
    '/about',
    '/privacy',
    '/security',
    '/terms',
  ].map((path) => {
    const page = discoveryPage(path, registry, { publicSite: true });
    return { path, title: page.title };
  });
  const categories = [...new Set(registry.formats.map((format) => format.category))].map(
    (category) => ({
      path: `/${category}-converter`,
      title: categoryContent[category]?.[0] || category,
    }),
  );
  const tasks = [
    'compress-image',
    'resize-image',
    'merge-pdf',
    'split-pdf',
    'ocr-document',
    'archive-browser',
    'create-code',
    'decode-jwt',
    'generate-id',
    'format-sql',
    'query-json',
    'markdown-editor',
    'diagram-studio',
  ].map((id) => ({ path: '/' + id, title: pages.get('/' + id)?.title || id }));
  return [
    '# Local Converter',
    '',
    site.mode === 'browser'
      ? '> Browser-only conversion tools for images, PDF documents, media, data and text.'
      : '> Public guides for an installed local app that converts supported files on the user’s computer.',
    '',
    site.mode === 'browser'
      ? `Canonical website: ${site.origin}. Files are processed in the visitor’s browser using JavaScript and WebAssembly. No local server or software installation is required. Engine downloads and device memory limits apply.`
      : `Canonical website: ${site.origin}. The public website does not accept uploads or run the local conversion server. Initial setup requires Node.js 24 or newer and the applicable local engines.`,
    '',
    'The Markdown guides below describe actual supported tasks, settings and limitations. They contain public documentation, not selected files or temporary job data. This file is an optional documentation index, not an access-control policy or a guarantee of search visibility.',
    '',
    ...section('Start here', info),
    ...section('File categories', categories),
    ...section('Selected tool guides', tasks),
    '## Optional',
    '',
    `- [Complete public guide corpus](${site.origin}/llms-full.txt): All guide text in one file; fetch individual Markdown pages when a smaller context is sufficient.`,
    `- [Site information](${site.origin}/humans.txt): Project and technology facts.`,
    '',
  ].join('\n');
}

export function discoveryFiles(site, registry, pages) {
  const files = new Map([['robots.txt', robotsText(site)]]);
  if (!site.indexable) {
    for (const name of discoveryFileNames.slice(1)) files.set(name, privateSummary);
    return files;
  }
  const corpus = [
    '# Local Converter — complete public guides',
    '',
    site.mode === 'browser'
      ? 'Browser conversion tools. Files are processed on the visitor’s device, without conversion uploads.'
      : 'Documentation for the installed local app. This public site does not accept file uploads.',
    '',
  ];
  for (const path of [...discoveryPaths(registry), ...pages.keys()]) {
    const text = guideMarkdown(path, site, registry, pages);
    files.set(markdownPath(path).slice(1), text);
    corpus.push(text, '---', '');
  }
  files.set('llms.txt', llmsIndex(site, registry, pages));
  files.set('llms-full.txt', corpus.join('\n'));
  files.set(
    'humans.txt',
    `/* SITE */\nProject: Local Converter\nWebsite: ${site.origin}\nLanguage: English\nPurpose: Public documentation for the installed local file conversion app.\n\n/* TECHNOLOGY */\nLocal interface: React\nLocal runtime: Node.js 24 or newer and installed conversion engines\nPublic site: Static HTML, CSS and Markdown\n\n/* INFORMATION */\nAbout: ${site.origin}/about\nPrivacy: ${site.origin}/privacy\nSecurity boundaries: ${site.origin}/security\n`,
  );
  if (site.mode === 'browser')
    files.set(
      'humans.txt',
      `/* SITE */\nProject: Local Converter\nWebsite: ${site.origin}\nLanguage: English\nPurpose: Browser-only file conversion; selected files stay on the visitor's device.\n\n/* TECHNOLOGY */\nInterface: React\nProcessing: JavaScript, WebAssembly and browser workers\nHosting: Static HTML, CSS, JavaScript, model and engine assets\n\n/* INFORMATION */\nAbout: ${site.origin}/about\nPrivacy: ${site.origin}/privacy\nSecurity: ${site.origin}/security\n`,
    );
  return files;
}
