import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import ExifReader from 'exifreader';
import { PDFDocument, PDFName, rgb } from 'pdf-lib';
import { createCanvas } from '@napi-rs/canvas';
import { zipSync } from 'fflate';
import mammoth from 'mammoth';
import sanitizeHtml from 'sanitize-html';
import Papa from 'papaparse';
import * as he from 'he';
import { readInput, textInput, fail, checkAbort, LIMITS } from './common.js';
import { openPdf } from './pdf.js';
import { inspectZip } from './packaging.js';
import { jsonChanges, statistics } from './productivity.js';

export function metadataReport(buffer) {
  const tags = ExifReader.load(buffer, { expanded: true });
  const fields = {};
  let count = 0;
  const walk = (obj, prefix = '', depth = 0) => {
    if (depth > 8 || !obj || typeof obj !== 'object') return;
    for (const [key, v] of Object.entries(obj)) {
      if (++count > 20000) fail('Metadata report contains too many fields.');
      if (/thumbnail|base64|image$/i.test(key)) continue;
      const name = prefix ? prefix + '.' + key : key;
      if (v && typeof v === 'object' && 'description' in v) {
        fields[name] = String(v.description).slice(0, 2000);
      } else if (v && typeof v === 'object' && !Array.isArray(v) && !ArrayBuffer.isView(v))
        walk(v, name, depth + 1);
      else if (['string', 'number', 'boolean'].includes(typeof v))
        fields[name] = String(v).slice(0, 2000);
    }
  };
  walk(tags);
  return fields;
}
const documentText = (html) =>
  he
    .decode(
      sanitizeHtml(
        html
          .replace(/<br\b[^>]*>/gi, '\n')
          .replace(/<\/t[dh]\s*>/gi, ' ')
          .replace(
            /<\/(?:p|h[1-6]|div|section|article|blockquote|li|tr|pre|ul|ol|table)\s*>/gi,
            '\n\n',
          ),
        { allowedTags: [], allowedAttributes: {} },
      ),
    )
    .trim();
export async function extractDocument(buffer, source, signal) {
  if (source === 'docx') {
    const entries = inspectZip(buffer);
    if (!entries['word/document.xml']) fail('Not a DOCX document.');
    const result = await mammoth.convertToHtml(
      { buffer },
      {
        externalFileAccess: false,
        convertImage: mammoth.images.imgElement(() => Promise.resolve({ src: '' })),
      },
    );
    const html = sanitizeHtml(result.value, {
      allowedTags: [
        ...sanitizeHtml.defaults.allowedTags,
        'h1',
        'h2',
        'table',
        'thead',
        'tbody',
        'tr',
        'th',
        'td',
      ],
      allowedAttributes: { a: ['href'] },
      allowedSchemes: ['http', 'https', 'mailto'],
    });
    return {
      html,
      text: documentText(html),
      paragraphs: (html.match(/<p\b/g) || []).length,
      headings: (html.match(/<h[1-6]\b/g) || []).length,
      warnings: result.messages.map((m) => ({ type: m.type, message: m.message })),
    };
  }
  if (source === 'pdf') {
    const pdf = await openPdf(buffer);
    try {
      if (pdf.numPages > 100) fail('PDF exceeds 100 pages.');
      const texts = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        checkAbort(signal);
        const page = await pdf.getPage(i),
          content = await page.getTextContent();
        texts.push(content.items.map((x) => x.str + (x.hasEOL ? '\n' : ' ')).join(''));
      }
      const text = texts.join('\n\n');
      if (!text.trim()) fail('No selectable PDF text. Run OCR first.');
      return { text, headings: null, pages: pdf.numPages, warnings: [] };
    } finally {
      await pdf.loadingTask.destroy();
    }
  }
  if (buffer.length > 1048576) fail('Text documents accept up to 1 MB.');
  let text = textInput(buffer),
    headings = 0,
    paragraphs;
  if (['html', 'htm'].includes(source)) {
    headings = (text.match(/<h[1-6]\b/gi) || []).length;
    paragraphs = (text.match(/<p\b/gi) || []).length;
    text = documentText(text);
  }
  if (['md', 'markdown'].includes(source)) {
    const { default: MarkdownIt } = await import('markdown-it');
    const tokens = new MarkdownIt().parse(text, {});
    headings = tokens.filter((t) => t.type === 'heading_open').length;
    paragraphs = tokens.filter((t) => t.type === 'paragraph_open').length;
    text = tokens
      .filter((t) => t.type === 'inline')
      .map((t) => t.children?.map((c) => c.content).join('') || t.content)
      .join('\n\n');
  }
  return { text, headings, ...(paragraphs !== undefined ? { paragraphs } : {}), warnings: [] };
}
export async function fileSignature(buffer, name) {
  const starts = (hex, offset = 0) =>
    buffer.subarray(offset, offset + hex.length / 2).equals(Buffer.from(hex, 'hex'));
  let detected = 'unknown',
    container;
  if (buffer.subarray(0, 5).toString() === '%PDF-') detected = 'pdf';
  else if (starts('89504e470d0a1a0a')) detected = 'png';
  else if (starts('ffd8ff')) detected = 'jpg';
  else if (/^GIF8[79]a$/.test(buffer.subarray(0, 6).toString())) detected = 'gif';
  else if (buffer.subarray(0, 4).toString() === 'RIFF') {
    const kind = buffer.subarray(8, 12).toString();
    detected = { WEBP: 'webp', WAVE: 'wav', 'AVI ': 'avi' }[kind] || 'riff';
  } else if (starts('49492a00') || starts('4d4d002a')) detected = 'tiff';
  else if (starts('424d')) detected = 'bmp';
  else if (starts('1f8b')) detected = 'gz';
  else if (starts('377abcaf271c')) detected = '7z';
  else if (starts('52617221')) detected = 'rar';
  else if (starts('4f676753')) detected = 'ogg';
  else if (starts('664c6143')) detected = 'flac';
  else if (starts('494433') || starts('fffb') || starts('fff3') || starts('fff2')) detected = 'mp3';
  else if (buffer.subarray(4, 8).toString() === 'ftyp') {
    const brand = buffer.subarray(8, 12).toString();
    detected = /avif|avis/.test(brand)
      ? 'avif'
      : /hei[cf]|mif1|heix/.test(brand)
        ? 'heic'
        : brand === 'qt  '
          ? 'mov'
          : brand.startsWith('M4A')
            ? 'm4a'
            : 'mp4';
  } else if (starts('504b0304') || starts('504b0506')) {
    detected = 'zip';
    container = 'zip';
    try {
      const entries = inspectZip(buffer);
      if (entries['word/document.xml']) detected = 'docx';
      else if (entries['xl/workbook.xml']) detected = 'xlsx';
      else if (entries['ppt/presentation.xml']) detected = 'pptx';
      else if (entries.mimetype?.toString().trim() === 'application/epub+zip') detected = 'epub';
    } catch {
      /* ZIP signature remains valid even when unsupported inspection fails. */
    }
  } else if (buffer.subarray(257, 262).toString() === 'ustar') detected = 'tar';
  else {
    try {
      const text = textInput(buffer);
      detected = /^\s*(?:<\?xml[^>]*>\s*)?<svg\b/i.test(text)
        ? 'svg'
        : /^\s*(?:<!doctype\s+html|<html\b)/i.test(text)
          ? 'html'
          : 'text';
    } catch {
      /* Unknown binary, no extension guessing. */
    }
  }
  const ext = name.toLowerCase().split('.').pop(),
    aliases = { jpeg: 'jpg', tif: 'tiff', htm: 'html', gzip: 'gz' },
    actual = aliases[ext] || ext;
  return {
    file: name,
    bytes: buffer.length,
    detected,
    ...(container ? { container } : {}),
    extension: ext,
    extensionMatches:
      detected === 'unknown'
        ? null
        : detected === 'text'
          ? ['txt', 'md', 'markdown', 'csv', 'json', 'yaml', 'xml', 'js', 'css', 'sql'].includes(
              actual,
            )
          : actual === detected,
    signatureHex: buffer.subarray(0, 24).toString('hex'),
  };
}
async function contactSheet(buffer, o, signal) {
  const pdf = await openPdf(buffer);
  try {
    if (pdf.numPages > 100) fail('PDF exceeds 100 pages.');
    const cellW = o.cellWidth,
      cellH = Math.round(cellW * 1.42) + 28,
      rows = Math.ceil(pdf.numPages / o.columns),
      width = o.columns * cellW,
      height = rows * cellH;
    if (width * height > LIMITS.pixels) fail('Contact sheet exceeds 40 million pixels.');
    const sheet = createCanvas(width, height),
      ctx = sheet.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);
    for (let i = 1; i <= pdf.numPages; i++) {
      checkAbort(signal);
      const page = await pdf.getPage(i),
        raw = page.getViewport({ scale: 1 }),
        scale = Math.min((cellW - 16) / raw.width, (cellH - 40) / raw.height),
        viewport = page.getViewport({ scale }),
        canvas = createCanvas(
          Math.max(1, Math.ceil(viewport.width)),
          Math.max(1, Math.ceil(viewport.height)),
        );
      const render = page.render({
        canvasContext: canvas.getContext('2d'),
        viewport,
        annotationMode: 0,
      });
      const cancel = () => render.cancel();
      signal?.addEventListener('abort', cancel, { once: true });
      try {
        await render.promise;
      } finally {
        signal?.removeEventListener('abort', cancel);
      }
      const x = ((i - 1) % o.columns) * cellW,
        y = Math.floor((i - 1) / o.columns) * cellH;
      ctx.drawImage(canvas, x + (cellW - canvas.width) / 2, y + 8);
      ctx.fillStyle = '#222';
      ctx.font = '14px sans-serif';
      ctx.fillText(`Page ${i}`, x + 8, y + cellH - 9);
      page.cleanup();
    }
    const png = sheet.toBuffer('image/png');
    if (o.format === 'png') return png;
    const out = await PDFDocument.create(),
      image = await out.embedPng(png),
      page = out.addPage([width * 0.75, height * 0.75]);
    page.drawImage(image, { width: width * 0.75, height: height * 0.75 });
    return Buffer.from(await out.save());
  } finally {
    await pdf.loadingTask.destroy();
  }
}
export async function convertReports({ operation, inputs, outputDir, options: o, signal }) {
  checkAbort(signal);
  const buffer = await readInput(inputs[0].path);
  let value,
    extension = 'json',
    mime = 'application/json',
    details = {};
  if (operation === 'compare-metadata') {
    if (inputs.length !== 2) fail('Choose exactly two images.');
    const before = metadataReport(buffer),
      after = metadataReport(await readInput(inputs[1].path));
    value = { before, after, changes: jsonChanges(before, after) };
  } else if (operation === 'photo-privacy') {
    const metadata = metadataReport(buffer),
      identifying = Object.fromEntries(
        Object.entries(metadata).filter(([key]) =>
          /gps|latitude|longitude|make|model|serial|artist|author|owner|date|time|software|creator|copyright|lens/i.test(
            key,
          ),
        ),
      );
    value = {
      hasIdentifyingMetadata: Object.keys(identifying).length > 0,
      fields: identifying,
      scope: 'Supported embedded metadata only; visible content is not analyzed.',
    };
  } else if (operation === 'image-metadata') {
    const all = metadataReport(buffer),
      fields = Object.fromEntries(
        Object.entries(all).filter(
          ([k, v]) => !o.search || `${k} ${v}`.toLowerCase().includes(o.search.toLowerCase()),
        ),
      );
    if (o.reportFormat === 'csv') {
      value = Papa.unparse(
        Object.entries(fields).map(([field, value]) => ({ field, value })),
        { escapeFormulae: true },
      );
      extension = 'csv';
      mime = 'text/csv';
    } else {
      const meta = await sharp(buffer, { limitInputPixels: LIMITS.pixels }).metadata();
      value = {
        width: meta.width,
        height: meta.height,
        dpi: meta.density,
        mode: meta.space,
        iccProfileBytes: meta.icc?.length || 0,
        fields,
      };
    }
  } else if (operation === 'pdf-metadata') {
    if (buffer.subarray(0, 5).toString() !== '%PDF-') fail('File is not a PDF.');
    const pdf = await PDFDocument.load(buffer, { updateMetadata: false });
    if (pdf.getPageCount() > 100) fail('PDF exceeds 100 pages.');
    if (o.mode === 'inspect')
      value = {
        title: pdf.getTitle() || '',
        author: pdf.getAuthor() || '',
        subject: pdf.getSubject() || '',
        keywords: pdf.getKeywords() || '',
        creator: pdf.getCreator() || '',
        producer: pdf.getProducer() || '',
        creationDate: pdf.getCreationDate()?.toISOString(),
        modificationDate: pdf.getModificationDate()?.toISOString(),
        pages: pdf.getPageCount(),
      };
    else {
      if (o.mode === 'remove') {
        pdf.context.trailerInfo.Info = undefined;
        pdf.catalog.delete(PDFName.of('Metadata'));
        for (const page of pdf.getPages()) page.node.delete(PDFName.of('Metadata'));
      } else {
        pdf.setTitle(o.title);
        pdf.setAuthor(o.author);
        pdf.setSubject(o.subject);
        pdf.setKeywords(
          o.keywords
            .split(',')
            .map((x) => x.trim())
            .filter(Boolean),
        );
      }
      value = Buffer.from(await pdf.save());
      extension = 'pdf';
      mime = 'application/pdf';
    }
  } else if (operation === 'pdf-page-size') {
    const source = await PDFDocument.load(buffer, { updateMetadata: false }),
      out = await PDFDocument.create();
    if (source.getPageCount() > 100) fail('PDF exceeds 100 pages.');
    const [width, height] =
      o.paper === 'letter' ? [612, 792] : o.paper === 'a4' ? [595.28, 841.89] : [o.width, o.height];
    if (o.margin * 2 >= Math.min(width, height)) fail('Margins must leave room for page content.');
    for (const original of source.getPages()) {
      checkAbort(signal);
      const page = out.addPage([width, height]);
      if (!original.node.has(PDFName.of('Contents'))) continue;
      const crop = original.getCropBox(),
        media = original.getMediaBox(),
        bounds = {
          left: Math.max(crop.x, media.x),
          bottom: Math.max(crop.y, media.y),
          right: Math.min(crop.x + crop.width, media.x + media.width),
          top: Math.min(crop.y + crop.height, media.y + media.height),
        };
      if (bounds.right <= bounds.left || bounds.top <= bounds.bottom)
        fail('PDF page has an empty visible crop.');
      const embed = await out.embedPage(original, bounds),
        rotation = ((original.getRotation().angle % 360) + 360) % 360,
        swap = rotation === 90 || rotation === 270,
        w = swap ? embed.height : embed.width,
        h = swap ? embed.width : embed.height,
        scale = Math.min((width - 2 * o.margin) / w, (height - 2 * o.margin) / h),
        x = (width - w * scale) / 2,
        y = (height - h * scale) / 2;
      const { degrees } = await import('pdf-lib');
      page.drawPage(embed, {
        x: x + (rotation === 180 || rotation === 270 ? w * scale : 0),
        y: y + (rotation === 90 || rotation === 180 ? h * scale : 0),
        width: embed.width * scale,
        height: embed.height * scale,
        rotate: degrees(-rotation),
      });
    }
    value = Buffer.from(await out.save());
    extension = 'pdf';
    mime = 'application/pdf';
    details.pages = out.getPageCount();
  } else if (operation === 'pdf-contact-sheet') {
    value = await contactSheet(buffer, o, signal);
    extension = o.format;
    mime = o.format === 'pdf' ? 'application/pdf' : 'image/png';
  } else if (operation === 'document-stats') {
    const doc = await extractDocument(buffer, inputs[0].source, signal);
    value = {
      ...statistics(doc.text),
      ...(doc.paragraphs !== undefined ? { paragraphs: doc.paragraphs } : {}),
      headings: doc.headings,
      ...(doc.pages ? { pages: doc.pages } : {}),
      warnings: doc.warnings,
    };
  } else if (operation === 'inspect-file') value = await fileSignature(buffer, inputs[0].name);
  else if (operation === 'docx-preview') {
    const doc = await extractDocument(buffer, 'docx', signal);
    value = doc.html;
    extension = 'html';
    mime = 'text/html; charset=utf-8';
    details = {
      preview: doc.text.slice(0, 4000),
      previewHtml: doc.html.slice(0, 150000),
      warnings: doc.warnings,
    };
  } else if (operation === 'diagram-studio') {
    const { renderDiagram } = await import('./visual-render.js');
    const rendered = await renderDiagram(textInput(buffer), o, signal);
    value = rendered;
    extension = o.format;
    mime = extension === 'svg' ? 'image/svg+xml' : 'image/png';
  } else fail('Unsupported report tool.');
  const data = Buffer.isBuffer(value)
    ? value
    : Buffer.from(typeof value === 'string' ? value : JSON.stringify(value, null, 2));
  if (data.length > LIMITS.outputBytes) fail('Result exceeds 200 MB.');
  checkAbort(signal);
  await fs.mkdir(outputDir, { recursive: true });
  const filename = `${operation}-${randomUUID().slice(0, 8)}.${extension}`,
    p = path.join(outputDir, filename);
  await fs.writeFile(p, data);
  if (['json', 'csv'].includes(extension))
    details = {
      ...details,
      preview: data.toString('utf8', 0, 4000),
      previewTruncated: data.length > 4000,
    };
  return { path: p, filename, mime, details };
}
