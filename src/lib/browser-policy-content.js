export function browserPolicyContent(route, registry) {
  const max = Math.round((registry.limits?.maxBytes || 104857600) / 1048576),
    privacy = route === '/privacy',
    terms = route === '/terms';
  return {
    title: terms ? 'Terms of use' : privacy ? 'Privacy' : 'Data security',
    intro: terms
      ? 'Use supported browser tools responsibly and review each result.'
      : 'Your selected files are processed in this browser, on this device.',
    icon: terms ? 'terms' : privacy ? 'privacy' : 'security',
    summary: terms ? 'Keep an original. Check the result.' : 'Files stay on your device.',
    facts: [
      ['Processing', 'In this browser'],
      ['Input limit', `${max} MB`],
      ['Results', 'Until removed or reloaded'],
    ],
    sections: [
      {
        id: 'processing',
        title: 'Where conversion happens',
        paragraphs: [
          'JavaScript, WebAssembly and browser workers process supported inputs on your device. Selected files and pasted tool input are not uploaded to a conversion API. No Node.js installation or localhost service is required.',
          'The website, fonts and engine files must load from the host. A fresh visit or an uncached engine needs internet access. Browser support, device memory and available CPU affect which operations can finish.',
        ],
      },
      {
        id: 'temporary-results',
        title: 'Temporary browser results',
        paragraphs: [
          'Selected files and generated results are held in memory for this tab. Removing a job or clearing the workspace releases its result. Reloading or closing the page clears the workspace. Download results you want to keep before leaving.',
          'A saved download is independent of the tab. Your original file is not replaced. The website is not a permanent backup service.',
        ],
      },
      {
        id: 'analytics',
        title: 'Google Analytics on the public website',
        paragraphs: [
          'The canonical public site uses Google Analytics 4 (G-PNZFZ75FT9) to measure page visits and technical browser/device information. Google may use first-party Analytics cookies. Browser settings and tracking protections can restrict collection.',
          'The configured page-view URL excludes query parameters and fragments. Selected filenames, file contents, pasted text, generated passwords and private result identifiers are not sent as Analytics events. Preview/local origins do not initialize Analytics collection.',
        ],
      },
      {
        id: 'limits',
        title: 'Limits and result review',
        paragraphs: [
          `Inputs are limited to ${max} MB, with smaller limits on individual operations. Jobs run one at a time and have time, page, image-pixel, archive-expansion and output-memory bounds. Large or malformed files may still fail.`,
          `Only choose content you are authorized to process. Format conversion can discard metadata, layout, layers, formulas or quality. Inspect downloaded results before relying on them. The tools are provided as is; browser processing is not a guarantee that an input is safe or that its output is accurate.`,
        ],
      },
    ],
    related: [
      ['/tools', 'Browse tools'],
      ['/how-it-works', 'How conversion works'],
      ['/privacy', 'Privacy'],
    ],
  };
}
