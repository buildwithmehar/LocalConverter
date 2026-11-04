import { select, text, flag } from './productivity-tools.js';
export function applyToolUpgrades(tools) {
  const find = (id) => tools.find((t) => t.id === id),
    extend = (id, fields) => {
      const t = find(id);
      t.fields = [...(t.fields || []), ...fields];
      t.defaults = { ...t.defaults, ...Object.fromEntries(fields.map((f) => [f.key, f.default])) };
    };
  const qr = find('create-code');
  qr.multiple = true;
  qr.accept = ['txt', 'png', 'jpg', 'webp'];
  qr.livePreview = 'qr';
  qr.sample = 'https://example.com';
  qr.summary = 'Create styled QR codes with an optional uploaded logo, or standard barcodes.';
  qr.guide =
    'Enter text or upload a TXT file. Optionally add one PNG/JPG/WebP logo. Contact preset uses name, phone and email on separate lines. Test the output before sharing.';
  extend('create-code', [
    select('preset', 'QR content', ['text', 'wifi', 'contact', 'email', 'sms', 'whatsapp']),
    text('password', 'Wi-Fi password', '', 200, 'password'),
    text('subject', 'Message or email subject', '', 500),
    select('dots', 'Dot style', ['square', 'rounded', 'dots', 'classy']),
    select('corners', 'Corner style', ['square', 'extra-rounded', 'dot']),
    { key: 'foreground', label: 'Foreground colour', type: 'color', default: '#000000' },
    { key: 'background', label: 'Background colour', type: 'color', default: '#ffffff' },
    flag('verify', 'Verify QR scan before download'),
  ]);
  const metadata = find('image-metadata');
  extend('image-metadata', [
    select('reportFormat', 'Metadata report format', ['json', 'csv']),
    text('search', 'Metadata search (optional)', '', 200),
  ]);
  metadata.note =
    'Inspect supported EXIF, IPTC and XMP fields, search and export JSON/CSV. Strip mode re-encodes pixels without copying metadata.';
  const compress = find('compress-image');
  compress.multiple = true;
  compress.browserMode = 'image';
  compress.note += ' Multiple images download together as a ZIP with an individual size report.';
  const semantic = find('semantic-document');
  semantic.browserMode = 'document';
  semantic.textInput = true;
  semantic.sample = '# Local document\n\nConvert this text on your computer.';
  semantic.note +=
    ' Optional browser mode uses bundled Pandoc WASM, with a 10 MB input budget and no direct PDF output.';
  for (const id of ['compare-text', 'compare-json']) find(id).multiple = true;
  tools.push({
    id: 'docx-preview',
    family: [51],
    title: 'DOCX preview & extraction',
    summary: 'Preview clean Word document content and inspect extraction warnings.',
    intro: 'Extract a sanitized HTML preview from a Word document.',
    category: 'document',
    icon: 'files',
    engine: 'reports',
    accept: ['docx'],
    multiple: false,
    minFiles: 1,
    action: 'Preview document',
    fields: [],
    defaults: {},
    guide:
      'Choose a DOCX document, create the preview, inspect any warnings and download clean HTML.',
    note: 'Mammoth extracts semantic content, not exact Word page layout. Images and active external resources are omitted.',
  });
}
