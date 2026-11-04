import { select, number, text, flag } from './productivity-tools.js';
const raster = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'tiff', 'heic', 'jxl', 'gif'];
const make = (id, title, summary, accept, fields = [], extra = {}) => ({
  id,
  title,
  summary,
  intro: summary,
  category: 'document',
  icon: 'files',
  engine: 'reports',
  accept,
  multiple: false,
  minFiles: 1,
  action: 'Create result',
  fields,
  defaults: Object.fromEntries(fields.map((f) => [f.key, f.default])),
  guide:
    'Choose the original source, adjust the settings, create the result and inspect the saved output.',
  note: 'Files stay on this computer. Maximum 100 PDF pages and 40 million image pixels; originals remain unchanged.',
  ...extra,
});
export const reportTools = [
  make(
    'diagram-studio',
    'Diagram studio',
    'Turn Mermaid text into flowcharts, sequence, ER, class, mindmap and Gantt diagrams.',
    ['txt', 'md', 'mmd'],
    [
      select('format', 'Download format', ['svg', 'png']),
      select('theme', 'Diagram theme', ['default', 'dark', 'neutral', 'forest']),
    ],
    {
      category: 'design',
      icon: 'data',
      textInput: true,
      livePreview: 'diagram',
      sample: 'flowchart LR\n  A[Choose a file] --> B[Convert locally]\n  B --> C[Download result]',
      note: 'Mermaid diagrams only, up to 30,000 characters. External images, links, HTML labels and initialization directives are disabled. Rendering has a 20-second deadline.',
    },
  ),
  make(
    'compare-metadata',
    'Image metadata comparison',
    'Compare camera, location, EXIF, IPTC and XMP information from two images.',
    raster,
    [],
    {
      category: 'image',
      multiple: true,
      minFiles: 2,
      note: 'Select exactly two images, original first. Reports describe supported metadata fields, not differences in image pixels.',
    },
  ),
  make(
    'photo-privacy',
    'Photo privacy report',
    'Check a photo for supported location, device, author and timestamp metadata.',
    raster,
    [],
    {
      category: 'image',
      note: 'A report lists detected metadata only. An empty report is not proof of anonymity; visible image content can still disclose personal details.',
    },
  ),
  make(
    'pdf-metadata',
    'PDF metadata editor',
    'Inspect PDF document information, edit selected fields or remove metadata.',
    ['pdf'],
    [
      select('mode', 'Operation', ['inspect', 'edit', 'remove']),
      text('title', 'Title'),
      text('author', 'Author'),
      text('subject', 'Subject'),
      text('keywords', 'Keywords (comma separated)'),
    ],
  ),
  make(
    'pdf-page-size',
    'PDF page size converter',
    'Fit PDF pages onto A4, Letter or a custom page with adjustable margins.',
    ['pdf'],
    [
      select('paper', 'Page size', ['a4', 'letter', 'custom']),
      number('width', 'Custom width (points)', 595.28, 72, 4000, 0.01),
      number('height', 'Custom height (points)', 841.89, 72, 4000, 0.01),
      number('margin', 'Margin (points)', 24, 0, 144),
    ],
    {
      note: 'Fits visible content without cropping and keeps aspect ratio. Pages are rebuilt; forms, links, bookmarks and signatures may not carry over. 72 points = 1 inch.',
    },
  ),
  make(
    'pdf-contact-sheet',
    'PDF contact sheet',
    'Create a labelled thumbnail overview of PDF pages as PNG or PDF.',
    ['pdf'],
    [
      select('format', 'Download format', ['png', 'pdf']),
      number('columns', 'Columns', 3, 1, 8),
      number('cellWidth', 'Thumbnail width (px)', 240, 100, 500),
    ],
    {
      note: 'Up to 100 PDF pages and 40 million sheet pixels. Page labels use original page numbers. This is a visual overview, not a replacement for readable full-size pages.',
    },
  ),
  make(
    'document-stats',
    'Document statistics',
    'Count extracted words, paragraphs and headings in supported text documents.',
    ['txt', 'md', 'markdown', 'html', 'htm', 'docx', 'pdf'],
    [],
    {
      textInput: true,
      sample: '# Project notes\n\nReview the document locally.',
      note: 'PDF requires selectable text; scans need OCR first. DOCX reports include extraction warnings. Counts describe extracted text, not exact Word pagination.',
    },
  ),
  make(
    'inspect-file',
    'File type inspector',
    'Inspect file signatures and compare supported detected types with the filename.',
    ['*'],
    [],
    {
      category: 'data',
      icon: 'data',
      note: 'Recognizes common images, PDFs, ZIP-based Office/EPUB files, archives, audio and video containers. Unknown binary data is reported as unknown rather than guessed from its extension.',
    },
  ),
];
for (const [i, t] of reportTools.entries()) t.family = [93 + i];
