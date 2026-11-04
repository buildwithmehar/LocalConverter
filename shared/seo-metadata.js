import { discoveryPage, searchTitles } from './search-content.js';
import { pageMetadata } from '../src/lib/page-metadata.js';

export function metadataFor(path, page, site, registry) {
  const browser = site.mode === 'browser' || registry?.mode === 'browser';
  const documentation = site.mode === 'public-guides',
    softwareId = site.origin + '/#software';
  const discovery = discoveryPage(path, registry, { publicSite: documentation }),
    info = pageMetadata[path];
  const known = Boolean(page || discovery || info || path === '/' || path === '/activity');
  const name =
    page?.title ||
    discovery?.title ||
    info?.title ||
    (path === '/activity' ? 'Your conversions' : 'Page not found');
  const searchName =
    browser && path === '/'
      ? 'Free Online File Converter'
      : page
        ? searchTitles[path.slice(1)] || name
        : info?.tabTitle || info?.title || discovery?.title || name;
  const description =
    (browser && path === '/'
      ? 'Convert images, PDFs, audio, video and data in your browser. Files stay on your device. No account or conversion uploads.'
      : '') ||
    page?.description ||
    discovery?.description ||
    info?.description ||
    'Find supported file converters and local tools in Local Converter. Read source requirements and output notes before processing your files.';
  const canonical = site.origin + path,
    indexable = site.indexable && Boolean(page || discovery) && path !== '/errors';
  const graph = [];
  if (page || discovery) {
    const collection = discovery?.kind === 'directory',
      items = discovery?.groups.flatMap((group) => group.items) || [];
    graph.push({
      '@type': collection ? 'CollectionPage' : path === '/about' ? 'AboutPage' : 'WebPage',
      '@id': canonical + '#page',
      url: canonical,
      name,
      description,
      inLanguage: 'en',
      isPartOf: { '@id': site.origin + '/#website' },
      ...(documentation ? { about: { '@id': softwareId } } : {}),
      ...(page && !documentation
        ? { mainEntity: { '@id': canonical + '#application' } }
        : items.length
          ? { mainEntity: { '@id': canonical + '#list' } }
          : {}),
    });
    // Describes the actual local application. No invented ratings/offers or rich-result promise.
    if (page && !documentation)
      graph.push({
        '@type': 'WebApplication',
        '@id': canonical + '#application',
        name,
        url: canonical,
        description,
        applicationCategory: 'UtilitiesApplication',
        operatingSystem: browser ? 'Any modern desktop or mobile OS' : 'Windows',
        browserRequirements: browser
          ? 'JavaScript and WebAssembly enabled; supported browser engines'
          : 'JavaScript enabled; installed local conversion server required',
        isAccessibleForFree: true,
        softwareRequirements: browser
          ? 'A compatible browser; no local server installation required'
          : 'Installed Local Converter and the conversion engine listed on this page',
      });
    if (documentation)
      graph.push({
        '@type': 'SoftwareApplication',
        '@id': softwareId,
        name: 'Local Converter',
        description:
          'Installed local file conversion application with a browser workspace. The public website provides guides; file conversion runs on the user’s computer.',
        applicationCategory: 'UtilitiesApplication',
        operatingSystem: 'Windows',
        softwareRequirements:
          'Node.js 24 or newer and the local conversion engines required by the selected operation',
      });
    if (items.length)
      graph.push({
        '@type': 'ItemList',
        '@id': canonical + '#list',
        name,
        numberOfItems: items.length,
        itemListElement: items.map((item, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: item.title,
          url: site.origin + item.path,
        })),
      });
    if (path !== '/')
      graph.push({
        '@type': 'BreadcrumbList',
        itemListElement: [
          { name: 'Home', url: site.origin + '/' },
          ...(page ? [{ name: 'Local tools', url: site.origin + '/tools' }] : []),
          { name, url: canonical },
        ].map((item, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: item.name,
          item: item.url,
        })),
      });
    graph.push({
      '@type': 'WebSite',
      '@id': site.origin + '/#website',
      url: site.origin + '/',
      name: 'Local Converter',
      inLanguage: 'en',
      description: browser
        ? 'Private browser-based file conversion, useful tools and practical guides. Files are processed on your device.'
        : 'Local file conversion tools and practical guides. The conversion app runs on your own computer.',
      sameAs: ['https://github.com/buildwithmehar/LocalConverter'],
    });
  }
  return {
    title: `${searchName} — Local Converter`,
    description,
    canonical,
    robots: indexable ? 'index, follow' : 'noindex, follow',
    image: site.origin + '/social-card.png',
    schema: graph.length ? { '@context': 'https://schema.org', '@graph': graph } : null,
    known,
  };
}
