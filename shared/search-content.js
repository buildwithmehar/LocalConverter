import { publicAnalyticsId } from './public-analytics.js';
import { browserDiscovery } from './browser-copy.js';
// Search intent is mapped to existing capabilities, never to unsupported formats.
export const publicSiteOrigin = 'https://localconverter.tech';
export const searchTitles = {
  'compress-image': 'Image Compressor — Reduce Image Size in KB',
  'resize-image': 'Image Resizer — Resize Photos in Pixels',
  'crop-image': 'Crop, Rotate & Flip Images',
  'archive-browser': 'Archive Extractor & ZIP File Browser',
  'generate-id': 'UUID v4 & ULID Generator',
  'generate-password': 'Password & Passphrase Generator',
  'decode-jwt': 'JWT Decoder — Inspect Header & Payload',
  'convert-timestamp': 'Unix Timestamp & Date Converter',
  'explain-cron': 'Cron Expression Parser & Schedule Checker',
  'test-regex': 'Regex Tester with Match & Capture Results',
  'count-text': 'Word Counter & Character Counter',
  'change-case': 'Text Case Converter & URL Slug Generator',
  'clean-lines': 'Remove Duplicate Lines & Clean Text',
  'placeholder-text': 'Lorem Ipsum & Placeholder Text Generator',
  'compare-text': 'Text Diff Checker — Compare Two Texts',
  'compare-json': 'JSON Diff Checker — Compare JSON Values',
  'query-json': 'JSONPath Tester & JSON Query Tool',
  'validate-json-schema': 'JSON Schema Validator — Draft 07',
  'format-code': 'HTML, CSS & JavaScript Formatter / Minifier',
  'diagram-studio': 'Mermaid Diagram Editor — Export SVG & PNG',
  'docx-preview': 'DOCX Viewer — Preview & Extract Word Content',
  'markdown-editor': 'Markdown Editor with Live HTML Preview',
};
export const categoryContent = {
  image: [
    'Image Converter',
    'Convert image formats such as PNG, JPG, WebP and AVIF on your computer. Resize, compress or crop supported still images before saving a separate result.',
    'Which image format should I choose?',
    'Choose PNG when transparency or sharp graphics matter, JPG for photographic delivery, or WebP/AVIF when the destination supports them. Converting an image cannot restore missing detail. Check dimensions, edges and transparency after export.',
  ],
  document: [
    'Document Converter',
    'Convert supported document content, create PDFs and work with PDF pages locally. Choose between text extraction, semantic conversion and layout rendering according to the result you need.',
    'Will document conversion preserve the layout?',
    'Text extraction and semantic conversion preserve different features from a page renderer. Use the dedicated Office or HTML rendering tools for visual layout, and inspect fonts, tables and page breaks in the saved PDF.',
  ],
  audio: [
    'Audio Converter',
    'Convert supported audio formats and extract existing soundtracks from videos using the installed local encoder. Read the available bitrate, channel and trim settings before processing.',
    'Does converting audio improve sound quality?',
    'Re-encoding cannot recover sound already lost to compression. Use a destination format your player supports, then compare clarity, duration and file size. Video-to-audio conversion needs an existing audio track.',
  ],
  video: [
    'Video Converter',
    'Re-encode supported video files, extract audio or create short GIF clips locally. The available routes depend on the installed encoder and the streams in your source.',
    'What should I check after converting a video?',
    'Play the result in the destination player. Check orientation, duration, audio synchronisation and the chosen resolution. Re-encoding changes quality and size; changing a file extension alone does not convert its contents.',
  ],
  data: [
    'Data Converter',
    'Convert supported JSON, CSV, XML, YAML and text data with local tools. Inspect the output structure and encoding before passing it to a database, script or spreadsheet.',
    'Can data conversion change values?',
    'Formats represent numbers, empty values and nested structures differently. Check leading zeros, Unicode text, null values and repeated records. A valid output file can still use a structure different from the one your next application expects.',
  ],
  spreadsheet: [
    'Spreadsheet Converter',
    'Export supported spreadsheet data into compatible formats locally. Check sheet selection, cell values, separators and character encoding before relying on a converted table.',
    'Are formulas and formatting preserved?',
    'Data-oriented exports can produce cell values without carrying formulas, formatting or every sheet. Compare headers, dates, identifiers and totals against the original workbook. Keep the editable workbook for future changes.',
  ],
  archive: [
    'Archive Converter',
    'Inspect supported archives and package files locally. Read each operation’s accepted archive types and output notes before extracting or creating a ZIP.',
    'Is an archive the same as a converted document?',
    'An archive packages files; it does not convert the documents inside it. Inspect filenames, folder paths and total expanded size. Unsupported encryption or resource limits can prevent extraction.',
  ],
  vector: [
    'Vector Converter',
    'Render supported SVG graphics into compatible image formats locally. Choose a pixel width appropriate to the final display, and check the background and fine details.',
    'Will a raster export stay scalable?',
    'Rendering SVG into PNG, JPG or another raster image creates a fixed pixel grid. Keep the SVG original if future resizing matters. Self-contained artwork is more predictable than an SVG that depends on external resources.',
  ],
  subtitle: [
    'Subtitle Converter',
    'Convert supported subtitle cues and timed text locally. Check the character encoding and test the output with the matching video before publishing captions.',
    'Does subtitle conversion change timing?',
    'A basic format conversion transfers supported cue text and time ranges. Advanced positioning and styling may be omitted. Use a dedicated offset tool when the entire track needs a timing shift.',
  ],
};
const link = (path, title) => ({ path, title });
const pairLink = (p) =>
  link(`/${p.source}-to-${p.target}`, `${p.source.toUpperCase()} to ${p.target.toUpperCase()}`);
const commonLinks = [
  link('/tools', 'All tools and conversion pairs'),
  link('/formats', 'Supported file formats'),
  link('/how-it-works', 'How local conversion works'),
  link('/privacy', 'File privacy and temporary storage'),
  link('/security', 'Local processing security'),
  link('/terms', 'Terms of use'),
  link('/help', 'Conversion help'),
];
const commonFaqs = [
  {
    question: 'Do files leave my computer?',
    answer:
      'In the installed local app, the browser sends selected files to its local server at 127.0.0.1 on the same computer. No external conversion API is used. The optional browser processing modes run supported operations inside the browser instead.',
  },
  {
    question: 'Can I convert files without internet access?',
    answer:
      'After installing the app, required engines and local runtime assets, conversions can run offline. Initial setup and dependency downloads need internet access. A public guide page alone does not install or run the local conversion engines.',
  },
  {
    question: 'How long can I download completed results?',
    answer:
      'Temporary local job copies normally expire after about 30 minutes of inactivity. Downloading a result refreshes its lifetime. Clearing jobs or restarting the server can remove working copies earlier. A download you have already saved is independent of that temporary storage.',
  },
];
export function discoveryPaths(registry) {
  const paths = [
    '/',
    '/tools',
    '/formats',
    '/help',
    '/about',
    '/how-it-works',
    '/security',
    '/privacy',
    '/terms',
  ];
  for (const category of new Set(registry.formats.map((f) => f.category)))
    paths.push(`/${category}-converter`);
  for (const format of registry.formats) {
    if (registry.pairs.some((p) => p.source === format.id)) paths.push(`/${format.id}-converter`);
    if (registry.pairs.some((p) => p.target === format.id)) paths.push(`/to-${format.id}`);
  }
  return [...new Set(paths)];
}
export function discoveryPage(path, registry, options = {}) {
  const page = localDiscoveryPage(path, registry, options);
  return registry?.mode === 'browser' ? browserDiscovery(page) : page;
}
function localDiscoveryPage(path, registry, { publicSite = false } = {}) {
  if (!registry) return null;
  const formats = registry.formats,
    pairs = registry.pairs,
    tools = registry.tools || [];
  const categories = [...new Set(formats.map((f) => f.category))];
  const groups = [],
    sections = [];
  let title,
    description,
    lead,
    faqs = [],
    kind = 'information';
  if (path === '/') {
    title = 'Local File Converter';
    description =
      'Convert images, PDFs, documents, audio, video and data on your computer. Explore local file converters, compression tools and developer utilities.';
    lead =
      'Local Converter is a file conversion workspace that runs on your computer. Choose a supported source, select a compatible output and save a separate result. The installed app uses local conversion engines instead of sending files to a remote conversion provider.';
    sections.push(
      {
        title: 'What can I do with Local Converter?',
        text: `This installation provides ${tools.length} dedicated tools and ${pairs.length} format conversions. Work with images, PDF pages, documents, media, archives and structured data, or use text and developer utilities. The directory lists actual supported routes and their limitations.`,
      },
      {
        title: 'How do I convert a file locally?',
        text: 'Start the installed local app, open a supported converter, select your source and choose the output. Review any settings, select Convert and download the completed result. Test one representative file before processing a batch and keep your original until you have checked the output.',
      },
    );
    groups.push(
      {
        title: 'Browse by file type',
        items: categories.map((c) =>
          link(`/${c}-converter`, categoryContent[c]?.[0] || `${c} converter`),
        ),
      },
      {
        title: 'Common conversion workflows',
        items: [
          'png-to-jpg',
          'webp-to-png',
          'jpg-to-png',
          'png-to-webp',
          'mp4-to-mp3',
          'docx-to-pdf',
          'csv-to-json',
          'json-to-csv',
        ]
          .filter((id) => pairs.some((p) => `${p.source}-to-${p.target}` === id))
          .map((id) => pairLink(pairs.find((p) => `${p.source}-to-${p.target}` === id))),
      },
    );
    groups.push({
      title: 'Find a tool by task',
      items: [
        'compress-image',
        'resize-image',
        'merge-pdf',
        'split-pdf',
        'ocr-document',
        'create-code',
        'decode-jwt',
        'markdown-editor',
      ]
        .map((id) => tools.find((tool) => tool.id === id))
        .filter(Boolean)
        .map((tool) => link('/' + tool.id, searchTitles[tool.id] || tool.title)),
    });
    faqs = commonFaqs;
    kind = 'home';
  } else if (path === '/tools') {
    title = 'Local Conversion Tools';
    description =
      'Browse image compressors, PDF tools, media converters, JSON utilities and text tools. Find supported local tools by file format or task.';
    lead = `Find ${tools.length} dedicated tools and ${pairs.length} format conversions available in the installed local app. Choose the operation that matches your actual source and desired output; an archive extractor, a text decoder and a document renderer solve different tasks.`;
    sections.push({
      title: 'How do I choose the right converter?',
      text: 'Search for the source and output, such as PNG to JPG, or choose a task such as merge PDF, resize image or format SQL. Open the tool to review its input requirements, settings and example. Available routes reflect the installed engines; an unsupported filename extension cannot be made compatible by renaming it.',
    });
    groups.push(
      {
        title: 'Dedicated tools',
        items: tools.map((t) => link('/' + t.id, searchTitles[t.id] || t.title)),
      },
      { title: 'Format conversions', items: pairs.map(pairLink) },
    );
    kind = 'directory';
  } else if (path === '/formats') {
    title = 'Supported File Formats';
    description =
      'Find supported image, document, audio, video, archive and data formats. Compare compatible source and output formats before converting locally.';
    lead = `Browse ${formats.length} file formats reported by this installation. Each source page lists its compatible outputs; each destination page lists supported inputs. Read the specific route notes when page layout, animation, formulas, metadata or exact values matter.`;
    sections.push({
      title: 'Which file formats can I convert?',
      text: 'Choose a format below to see actual conversion pairs. A format being listed does not mean every embedded feature is supported. For example, extracting document text differs from reproducing its page layout, and a still-image export differs from converting an animation.',
    });
    groups.push(
      ...categories.map((c) => ({
        title: categoryContent[c]?.[0] || c,
        items: formats
          .filter((f) => f.category === c)
          .map((f) => link(`/${f.id}-converter`, `${f.id.toUpperCase()} — ${f.label}`))
          .filter((item) => discoveryPaths(registry).includes(item.path)),
      })),
    );
    kind = 'directory';
  } else {
    const category = categories.find((c) => path === `/${c}-converter`),
      format = formats.find((f) => path === `/${f.id}-converter` || path === `/to-${f.id}`);
    if (category) {
      const content = categoryContent[category];
      if (!content) return null;
      [title, lead] = content;
      description = `${lead.split('. ')[0]}. Browse compatible formats, available conversions and practical output notes.`;
      kind = 'directory';
      groups.push(
        {
          title: 'Supported conversions',
          items: pairs
            .filter((p) => formats.find((f) => f.id === p.source)?.category === category)
            .map(pairLink),
        },
        {
          title: 'Tools for this file type',
          items: tools
            .filter((t) => t.category === category)
            .map((t) => link('/' + t.id, searchTitles[t.id] || t.title)),
        },
      );
      sections.push({ title: content[2], text: content[3] });
    } else if (format) {
      const incoming = path.startsWith('/to-'),
        id = format.id.toUpperCase(),
        matching = pairs.filter((p) =>
          incoming ? p.target === format.id : p.source === format.id,
        );
      if (!matching.length) return null;
      title = incoming ? `Convert to ${id}` : `${id} Converter`;
      kind = 'directory';
      description = incoming
        ? `Convert supported files to ${id} locally. Compare available input formats and read settings and limitations for each conversion before saving your result.`
        : `Convert ${id} files locally to supported output formats. Review compatible conversions, settings and format limitations before downloading a new copy.`;
      lead = incoming
        ? `Create ${id} (${format.label}) output from a supported source using the installed local app. Choose the source format below to open a converter with its own settings, example and output limitations.`
        : `Convert ${id} (${format.label}) files into one of the compatible outputs below. Choose a destination based on the content you need to keep, then inspect a saved example in the application where you intend to use it.`;
      sections.push({
        title: incoming ? `How do I convert a file to ${id}?` : `How do I convert a ${id} file?`,
        text: `Open a supported conversion below, select the original file, review the available options and select Convert. Download the result before its temporary job expires. ${categoryContent[format.category]?.[3] || 'Check the saved output against the original before using it.'}`,
      });
      groups.push(
        {
          title: incoming ? `Supported sources for ${id}` : `Convert ${id} to`,
          items: matching.map(pairLink),
        },
        {
          title: 'Explore the opposite direction',
          items: [
            link(
              incoming ? `/${format.id}-converter` : `/to-${format.id}`,
              incoming ? `${id} source conversions` : `Convert other formats to ${id}`,
            ),
          ].filter((item) => discoveryPaths(registry).includes(item.path)),
        },
      );
      faqs = [
        {
          question: `Does ${id} conversion require a remote upload?`,
          answer: commonFaqs[0].answer,
        },
      ];
    } else return informationPage(path, commonLinks, { publicSite });
  }
  return {
    kind,
    path,
    title,
    description,
    lead,
    sections,
    groups: groups.filter((g) => g.items.length),
    faqs,
    links: commonLinks.filter((item) => item.path !== path),
  };
}
function informationPage(path, links, { publicSite = false } = {}) {
  const definitions = {
    '/about': [
      'About Local Converter',
      'Local Converter is an independent local file conversion application. Its browser interface connects to installed tools on the same computer.',
      'What makes the local workflow different?',
      'The installed app uses libraries and conversion executables on your computer. It does not rely on a remote conversion provider, a login or a cloud-storage account. Different engines preserve different features, so the guides explain supported inputs and practical limitations.',
    ],
    '/how-it-works': [
      'How Local File Conversion Works',
      'Select a source, choose a supported output, run the local conversion and download a separate result. Keep the original until you have checked the output.',
      'What happens after I press Convert?',
      'Your browser sends the selected input to the local server. A session-owned job runs through the appropriate installed engine. Completed results can be downloaded, cancelled jobs stop processing and failed jobs show a message to help you correct the source or settings.',
    ],
    '/help': [
      'Local Converter Help',
      'Find answers about file formats, failed conversions, output settings and expired downloads in the installed local app.',
      'Why did my conversion fail?',
      'Check that the original opens correctly and its contents match its extension. Read the error beside the job, confirm the source is supported and try the default settings with a small example. An expired download requires a fresh conversion; opening an old job in another session does not transfer ownership.',
    ],
    '/privacy': [
      'File Privacy & Local Processing',
      'Selected files are processed by the app on your own computer. Read how browser selections, local working copies and downloaded results differ.',
      'Where are my files stored?',
      'Pending selections remain in the browser tab. Running jobs use temporary local copies owned by that browser session. Temporary results normally expire after about 30 minutes of inactivity and can be removed sooner by clearing jobs or restarting the app. Saved downloads remain in the folder where you put them.',
    ],
    '/security': [
      'Local File Conversion Security',
      'Learn how local processing, session ownership and temporary job storage work, and understand their practical limits.',
      'How is the local conversion service protected?',
      'The default server listens on loopback and checks its own host, origin and session token. Downloads are restricted to the job’s session. These measures do not make native file parsers a complete hostile-file sandbox or provide malware scanning, encrypted temporary storage or secure disk erasure.',
    ],
    '/terms': [
      'Local Converter Terms of Use',
      'Review supported conversions, output limitations and third-party software licenses before relying on a local result.',
      'What does a completed conversion mean?',
      'A completed job means the installed engine produced a file. It does not certify every word, pixel, formula or metadata field against the original. Keep your source, inspect important results and use files you have permission to process. Underlying libraries and executables retain their own licenses.',
    ],
  };
  const value = definitions[path];
  if (!value) return null;
  const sections = [{ title: value[2], text: value[3] }];
  let description = value[1],
    lead = value[1];
  if (path === '/privacy' && publicSite) {
    description =
      'How this public guide website uses Google Analytics, and how the installed Local Converter app handles selected files and temporary local results.';
    lead =
      'This public guide website uses Google Analytics to measure page visits. The installed local conversion app handles files on your computer and does not include this public website’s Analytics tag. These are separate workflows.';
    sections.unshift({
      title: 'Google Analytics on the public website',
      text: `The public website uses Google Analytics 4 with Measurement ID ${publicAnalyticsId}. The Google tag measures page visits and technical browser/device information and can use first-party Analytics cookies, subject to browser settings. Requests go to Google’s services. The website accepts no file uploads; the private local app does not load this tag. Google Signals and ad-personalization signals are disabled by this site’s configuration.`,
    });
    sections.push({
      title: 'Page information and tracking boundaries',
      text: 'The configured page view uses the page’s canonical URL without query parameters or fragments. Referrer information is reduced to the referring origin. Localhost, HTTP and unrelated preview origins do not initialize Analytics collection. The site does not send selected filenames, file contents, pasted source text, passwords or private conversion job identifiers as Analytics events. Browser cookie controls and tracking protections can limit collection; Analytics property settings also affect retention and optional measurement features.',
    });
  }
  if (path === '/how-it-works')
    sections.push({
      title: 'What do I need to install?',
      text: 'The current local app requires Node.js 24 or newer and its source project files. From the project folder, run npm ci, then npm run build and npm start. Open http://127.0.0.1:3000 on that computer. Install the native engines needed for your chosen operations; unavailable engines reduce the conversion routes. Initial installation needs internet access. This public guide does not include an installer or install native tools for you.',
    });
  return {
    kind: 'information',
    path,
    title: value[0],
    description,
    lead,
    sections,
    groups: [],
    faqs: path === '/terms' ? [] : commonFaqs,
    links: links.filter((item) => item.path !== path),
  };
}
