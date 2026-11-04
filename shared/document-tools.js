const select = (key, label, values, value) => ({
  key,
  label,
  type: 'select',
  options: values.map((v) => [v, v.toUpperCase()]),
  default: value,
});
const num = (key, label, value, min, max) => ({
  key,
  label,
  type: 'number',
  default: value,
  min,
  max,
});
const text = (key, label, value = '', type = 'text') => ({
  key,
  label,
  type,
  default: value,
  maxLength: 10000,
});
const tool = (id, family, title, accept, fields, extra = {}) => ({
  id,
  family: [family],
  title,
  category: 'document',
  icon: 'files',
  summary: title + ' using local document engines.',
  intro: 'Upload your files and choose the output settings.',
  action: 'Process document',
  accept,
  multiple: false,
  minFiles: 1,
  engine: 'document',
  defaults: Object.fromEntries(fields.map((f) => [f.key, f.default])),
  fields,
  guide: 'Choose a file, adjust the settings, then download the result.',
  note: 'Maximum 100 PDF pages; render and OCR jobs allow 20 pages.',
  ...extra,
});
export const documentTools = [
  tool(
    'reorder-pdf',
    25,
    'Reorder PDF pages',
    ['pdf'],
    [text('pages', 'Page order (for example 3,1,2)', '1')],
    { note: 'Each page may appear once. Omitted pages are removed.' },
  ),
  tool(
    'rotate-pdf',
    25,
    'Rotate PDF pages',
    ['pdf'],
    [
      text('pages', 'Pages (blank means all)'),
      select('angle', 'Clockwise rotation', ['90', '180', '270'], '90'),
    ],
  ),
  tool(
    'compress-pdf',
    26,
    'Compress PDF',
    ['pdf'],
    [
      select('mode', 'Compression mode', ['lossless', 'raster'], 'lossless'),
      num('dpi', 'Raster resolution (DPI)', 120, 72, 200),
      num('quality', 'JPEG quality', 75, 30, 95),
    ],
    {
      note: 'Lossless optimization may not reduce size. Raster mode replaces pages with images and removes text, links and forms.',
    },
  ),
  tool(
    'ocr-document',
    27,
    'OCR image or scanned PDF',
    ['pdf', 'png', 'jpg', 'jpeg', 'tif', 'tiff', 'webp'],
    [select('format', 'Output', ['txt', 'pdf'], 'txt')],
    {
      note: 'Local English OCR. Searchable PDF includes the original page image and an aligned text layer. Maximum 20 pages.',
    },
  ),
  tool(
    'office-render',
    28,
    'Office to PDF or page images',
    ['docx', 'xlsx', 'pptx', 'odt', 'ods', 'odp', 'rtf'],
    [
      select('format', 'Output', ['pdf', 'png', 'jpg'], 'pdf'),
      num('dpi', 'Image resolution', 120, 72, 180),
    ],
    {
      note: 'LibreOffice renders layout. Fonts and complex features can differ. Image outputs are a page ZIP. External links/macros and RTF fields/objects must be removed first.',
    },
  ),
  tool(
    'protect-pdf',
    41,
    'Password protect PDF',
    ['pdf'],
    [text('password', 'Open password', '', 'password')],
    { note: 'Encrypts with AES-256. Choose a nonempty password and keep it safe.' },
  ),
  tool(
    'unlock-pdf',
    41,
    'Unlock PDF with known password',
    ['pdf'],
    [text('password', 'Known open password', '', 'password')],
    { note: 'Requires the correct password; does not recover passwords.' },
  ),
  tool(
    'stamp-pdf',
    42,
    'PDF stamps and page numbers',
    ['pdf'],
    [
      select('kind', 'Stamp', ['text', 'numbers', 'watermark', 'overlay'], 'text'),
      text('text', 'Stamp text', 'CONFIDENTIAL'),
      text('pages', 'Pages (blank means all)'),
      num('fontSize', 'Font size', 18, 8, 100),
      num('opacity', 'Text opacity (%)', 40, 5, 100),
    ],
    {
      multiple: true,
      note: 'Single-line Latin-1 stamps use Helvetica. For overlay, upload the destination PDF first and overlay PDF second; its existing opacity is preserved. Page numbers follow original page positions.',
    },
  ),
  tool(
    'fill-pdf-form',
    43,
    'Fill and flatten PDF forms',
    ['pdf'],
    [
      text('values', 'Field values as JSON', '{}', 'textarea'),
      { key: 'flatten', label: 'Flatten fields', type: 'checkbox', default: true },
    ],
    {
      note: 'Standard AcroForm text, checkbox (JSON true/false) and single-choice fields. Dynamic XFA forms are rejected. Unknown field names fail with available names.',
    },
  ),
  tool('extract-pdf-images', 44, 'Extract original PDF images', ['pdf'], [], {
    note: 'Exports embedded image objects in a ZIP, with a JSON index. Page rendering and vector drawings are separate.',
  }),
  tool(
    'compare-pdfs',
    45,
    'Compare two PDFs',
    ['pdf'],
    [num('dpi', 'Visual comparison DPI', 90, 72, 120)],
    {
      multiple: true,
      minFiles: 2,
      note: 'Upload exactly two PDFs. ZIP contains textual changes, pixel difference statistics and visual difference PNGs; maximum 20 pages.',
    },
  ),
  tool(
    'pdf-tables',
    46,
    'PDF tables to CSV or Excel',
    ['pdf'],
    [
      select('format', 'Output', ['csv', 'xlsx'], 'xlsx'),
      select('strategy', 'Table detection', ['lines', 'text'], 'lines'),
    ],
    {
      note: 'Extracts selectable-text tables. For scans, first run searchable-PDF OCR, then use text detection. Irregular/merged cells need review. CSV tables are in a ZIP.',
    },
  ),
  tool('pdf-markdown', 47, 'PDF to Markdown', ['pdf'], [], {
    note: 'Layout-aware text and table extraction. Scans need OCR first; reading order and complex layouts need review.',
  }),
  tool(
    'render-html',
    49,
    'Render local HTML and CSS',
    ['html', 'htm', 'css', 'png', 'jpg', 'jpeg', 'svg', 'woff', 'woff2'],
    [
      select('format', 'Output', ['pdf', 'png'], 'pdf'),
      num('width', 'Viewport width', 1280, 320, 2400),
      num('height', 'Viewport height', 900, 200, 2400),
    ],
    {
      multiple: true,
      note: 'Upload HTML first, followed by relative CSS/image/font assets. Network access and JavaScript are disabled. Asset paths must use uploaded basenames. PNG captures the viewport.',
    },
  ),
  tool(
    'convert-ebook',
    50,
    'Convert EPUB, MOBI and AZW3',
    ['epub', 'mobi', 'azw3'],
    [select('format', 'Output', ['epub', 'mobi', 'azw3', 'pdf', 'txt'], 'epub')],
    {
      note: 'Calibre converts unprotected ebooks. DRM-protected books are unsupported. PDF layout depends on the ebook.',
    },
  ),
  tool(
    'semantic-document',
    51,
    'Convert Markdown, HTML and Office text',
    ['md', 'markdown', 'html', 'htm', 'docx', 'rtf', 'odt'],
    [select('format', 'Output', ['md', 'html', 'docx', 'rtf', 'odt', 'epub'], 'docx')],
    {
      note: 'Pandoc preserves semantic structure; this is not a page-layout renderer. External and embedded active resources are rejected.',
    },
  ),
  tool(
    'convert-font',
    52,
    'Convert TTF, OTF, WOFF and WOFF2',
    ['ttf', 'otf', 'woff', 'woff2'],
    [select('format', 'Output container', ['woff', 'woff2', 'sfnt'], 'woff2')],
    {
      category: 'design',
      note: 'SFNT restores TTF or OTF according to the original outline flavour. Container conversion preserves outlines; it does not convert CFF to TrueType.',
    },
  ),
];
