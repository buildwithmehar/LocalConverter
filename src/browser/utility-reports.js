import { PDFDocument, PDFName, degrees } from 'pdf-lib';
import {
  abort,
  decode,
  fail,
  result,
  jsonChanges,
  statistics,
  safeUnzip,
  textBytes,
} from './utility-common.js';
export async function metadataReport(bytes) {
  const { default: ExifReader } = await import('exifreader');
  const data =
      bytes instanceof ArrayBuffer
        ? bytes
        : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    tags = ExifReader.load(data, { expanded: true }),
    fields = {};
  let count = 0;
  const walk = (obj, prefix = '', depth = 0) => {
    if (depth > 8 || !obj || typeof obj !== 'object') return;
    for (const [key, v] of Object.entries(obj)) {
      if (++count > 20000) fail('Metadata report contains too many fields.');
      if (/thumbnail|base64|image$/i.test(key)) continue;
      const name = prefix ? prefix + '.' + key : key;
      if (v && typeof v === 'object' && 'description' in v)
        fields[name] = String(v.description).slice(0, 2000);
      else if (v && typeof v === 'object' && !Array.isArray(v) && !ArrayBuffer.isView(v))
        walk(v, name, depth + 1);
      else if (['string', 'number', 'boolean'].includes(typeof v))
        fields[name] = String(v).slice(0, 2000);
    }
  };
  walk(tags);
  return fields;
}
export async function safeHtml(html) {
  const { safeDocumentResult } = await import('../tool-runtime/safe-document.js');
  return decode((await safeDocumentResult({ bytes: textBytes(html), mime: 'text/html' })).bytes);
}
async function documentText(html) {
  const { default: DOMPurify } = await import('dompurify');
  const clean = DOMPurify.sanitize(html, {
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'img', 'link', 'meta', 'base'],
  });
  const doc = new DOMParser().parseFromString(clean, 'text/html');
  for (const br of doc.querySelectorAll('br')) br.replaceWith('\n');
  for (const cell of doc.querySelectorAll('td,th')) cell.append(' ');
  for (const block of doc.querySelectorAll(
    'p,h1,h2,h3,h4,h5,h6,div,section,article,blockquote,li,tr,pre,ul,ol,table',
  ))
    block.append('\n\n');
  return (doc.body.textContent || '').trim();
}
export async function extractDocument(input, signal) {
  const { bytes, source } = input;
  abort(signal);
  if (source === 'docx') {
    const files = safeUnzip(bytes);
    if (!files['word/document.xml']) fail('Not a DOCX document.');
    const { default: mammoth } = await import('mammoth/mammoth.browser.js');
    const conversion = await mammoth.convertToHtml(
      { arrayBuffer: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) },
      {
        externalFileAccess: false,
        convertImage: mammoth.images.imgElement(() => Promise.resolve({ src: '' })),
      },
    );
    const html = await safeHtml(conversion.value),
      text = await documentText(html);
    return {
      html,
      text,
      paragraphs: (conversion.value.match(/<p\b/g) || []).length,
      headings: (conversion.value.match(/<h[1-6]\b/g) || []).length,
      warnings: conversion.messages.map((m) => ({ type: m.type, message: m.message })),
    };
  }
  if (source === 'pdf') {
    const { pdfText } = await import('./pdf-engine.js');
    const pages = await pdfText(new Blob([bytes], { type: 'application/pdf' }), { signal });
    const text = pages.join('\n\n');
    if (!text.trim()) fail('No selectable PDF text. Run OCR first.');
    return { text, headings: null, pages: pages.length, warnings: [] };
  }
  let text = decode(bytes, 1048576),
    headings = 0,
    paragraphs;
  if (['html', 'htm'].includes(source)) {
    headings = (text.match(/<h[1-6]\b/gi) || []).length;
    paragraphs = (text.match(/<p\b/gi) || []).length;
    text = await documentText(text);
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
export function fileSignature(bytes, name) {
  const ascii = (a, b) => new TextDecoder('latin1').decode(bytes.subarray(a, b)),
    starts = (hex, offset = 0) =>
      [...hex.matchAll(/../g)].every((m, i) => bytes[offset + i] === parseInt(m[0], 16));
  let detected = 'unknown',
    container;
  if (ascii(0, 5) === '%PDF-') detected = 'pdf';
  else if (starts('89504e470d0a1a0a')) detected = 'png';
  else if (starts('ffd8ff')) detected = 'jpg';
  else if (/^GIF8[79]a$/.test(ascii(0, 6))) detected = 'gif';
  else if (ascii(0, 4) === 'RIFF')
    detected = { WEBP: 'webp', WAVE: 'wav', 'AVI ': 'avi' }[ascii(8, 12)] || 'riff';
  else if (starts('49492a00') || starts('4d4d002a')) detected = 'tiff';
  else if (starts('424d')) detected = 'bmp';
  else if (starts('1f8b')) detected = 'gz';
  else if (starts('377abcaf271c')) detected = '7z';
  else if (starts('52617221')) detected = 'rar';
  else if (starts('4f676753')) detected = 'ogg';
  else if (starts('664c6143')) detected = 'flac';
  else if (starts('494433') || starts('fffb') || starts('fff3') || starts('fff2')) detected = 'mp3';
  else if (ascii(4, 8) === 'ftyp') {
    const brand = ascii(8, 12);
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
      const entries = safeUnzip(bytes);
      if (entries['word/document.xml']) detected = 'docx';
      else if (entries['xl/workbook.xml']) detected = 'xlsx';
      else if (entries['ppt/presentation.xml']) detected = 'pptx';
      else if (entries.mimetype && decode(entries.mimetype).trim() === 'application/epub+zip')
        detected = 'epub';
    } catch {
      /* Report the ZIP signature even when the container is unsupported. */
    }
  } else if (ascii(257, 262) === 'ustar') detected = 'tar';
  else
    try {
      const text = decode(bytes, 100 * 1024 * 1024);
      detected = /^\s*(?:<\?xml[^>]*>\s*)?<svg\b/i.test(text)
        ? 'svg'
        : /^\s*(?:<!doctype\s+html|<html\b)/i.test(text)
          ? 'html'
          : text.includes('\0')
            ? 'unknown'
            : 'text';
    } catch {}
  const ext = name.toLowerCase().split('.').pop(),
    actual = { jpeg: 'jpg', tif: 'tiff', htm: 'html', gzip: 'gz' }[ext] || ext;
  return {
    file: name,
    bytes: bytes.length,
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
    signatureHex: [...bytes.subarray(0, 24)].map((n) => n.toString(16).padStart(2, '0')).join(''),
  };
}
export async function canvasBlob(canvas, type = 'image/png') {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Image encoding failed.'))), type),
  );
}
async function contactSheet(bytes, o, signal) {
  const { openPdf, renderPage } = await import('./pdf-engine.js'),
    pdf = await openPdf(new Blob([bytes], { type: 'application/pdf' }));
  try {
    if (pdf.numPages > 100) fail('PDF exceeds 100 pages.');
    const cellW = o.cellWidth,
      cellH = Math.round(cellW * 1.42) + 28,
      width = o.columns * cellW,
      height = Math.ceil(pdf.numPages / o.columns) * cellH;
    if (width * height > 40000000) fail('Contact sheet exceeds 40 million pixels.');
    const sheet = document.createElement('canvas');
    sheet.width = width;
    sheet.height = height;
    const ctx = sheet.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);
    for (let i = 1; i <= pdf.numPages; i++) {
      abort(signal);
      const p = await pdf.getPage(i),
        raw = p.getViewport({ scale: 1 }),
        scale = Math.min((cellW - 16) / raw.width, (cellH - 40) / raw.height),
        canvas = await renderPage(pdf, i, scale, signal),
        x = ((i - 1) % o.columns) * cellW,
        y = Math.floor((i - 1) / o.columns) * cellH;
      ctx.drawImage(canvas, x + (cellW - canvas.width) / 2, y + 8);
      ctx.fillStyle = '#222';
      ctx.font = '14px sans-serif';
      ctx.fillText(`Page ${i}`, x + 8, y + cellH - 9);
      canvas.width = canvas.height = 0;
      p.cleanup();
    }
    const png = new Uint8Array(await (await canvasBlob(sheet)).arrayBuffer());
    sheet.width = sheet.height = 0;
    if (o.format === 'png') return result(png, 'png');
    const out = await PDFDocument.create(),
      image = await out.embedPng(png),
      p = out.addPage([width * 0.75, height * 0.75]);
    p.drawImage(image, { width: width * 0.75, height: height * 0.75 });
    return result(await out.save(), 'pdf');
  } finally {
    await pdf.loadingTask.destroy();
  }
}
export async function runReport(operation, inputs, o, signal) {
  const input = inputs[0],
    bytes = input.bytes;
  abort(signal);
  if (operation === 'inspect-file') return result(fileSignature(bytes, input.name));
  if (operation === 'compare-metadata') {
    if (inputs.length !== 2) fail('Choose exactly two images.');
    const before = await metadataReport(bytes),
      after = await metadataReport(inputs[1].bytes);
    return result({ before, after, changes: jsonChanges(before, after) });
  }
  if (operation === 'photo-privacy') {
    const metadata = await metadataReport(bytes),
      fields = Object.fromEntries(
        Object.entries(metadata).filter(([k]) =>
          /gps|latitude|longitude|make|model|serial|artist|author|owner|date|time|software|creator|copyright|lens/i.test(
            k,
          ),
        ),
      );
    return result({
      hasIdentifyingMetadata: !!Object.keys(fields).length,
      fields,
      scope: 'Supported embedded metadata only; visible content is not analyzed.',
    });
  }
  if (operation === 'document-stats') {
    const doc = await extractDocument(input, signal);
    return result({
      ...statistics(doc.text),
      ...(doc.paragraphs !== undefined ? { paragraphs: doc.paragraphs } : {}),
      headings: doc.headings,
      ...(doc.pages ? { pages: doc.pages } : {}),
      warnings: doc.warnings,
    });
  }
  if (operation === 'docx-preview') {
    const doc = await extractDocument({ ...input, source: 'docx' }, signal);
    return result(doc.html, 'html', {
      preview: doc.text.slice(0, 4000),
      previewHtml: doc.html.slice(0, 150000),
      warnings: doc.warnings,
    });
  }
  if (operation === 'pdf-contact-sheet') return contactSheet(bytes, o, signal);
  if (operation === 'pdf-metadata') {
    if (decode(bytes.subarray(0, 5)) !== '%PDF-') fail('File is not a PDF.');
    const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
    if (pdf.getPageCount() > 100) fail('PDF exceeds 100 pages.');
    if (o.mode === 'inspect')
      return result({
        title: pdf.getTitle() || '',
        author: pdf.getAuthor() || '',
        subject: pdf.getSubject() || '',
        keywords: pdf.getKeywords() || '',
        creator: pdf.getCreator() || '',
        producer: pdf.getProducer() || '',
        creationDate: pdf.getCreationDate()?.toISOString(),
        modificationDate: pdf.getModificationDate()?.toISOString(),
        pages: pdf.getPageCount(),
      });
    if (o.mode === 'remove') {
      pdf.context.trailerInfo.Info = undefined;
      pdf.catalog.delete(PDFName.of('Metadata'));
      for (const page of pdf.getPages()) page.node.delete(PDFName.of('Metadata'));
    } else {
      pdf.setTitle(o.title || '');
      pdf.setAuthor(o.author || '');
      pdf.setSubject(o.subject || '');
      pdf.setKeywords(
        (o.keywords || '')
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean),
      );
    }
    return result(await pdf.save(), 'pdf');
  }
  if (operation === 'pdf-page-size') {
    const source = await PDFDocument.load(bytes, { updateMetadata: false }),
      out = await PDFDocument.create();
    if (source.getPageCount() > 100) fail('PDF exceeds 100 pages.');
    const [width, height] =
      o.paper === 'letter' ? [612, 792] : o.paper === 'a4' ? [595.28, 841.89] : [o.width, o.height];
    if (o.margin * 2 >= Math.min(width, height)) fail('Margins must leave room for page content.');
    for (const original of source.getPages()) {
      abort(signal);
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
      page.drawPage(embed, {
        x: x + (rotation === 180 || rotation === 270 ? w * scale : 0),
        y: y + (rotation === 90 || rotation === 180 ? h * scale : 0),
        width: embed.width * scale,
        height: embed.height * scale,
        rotate: degrees(-rotation),
      });
    }
    return result(await out.save(), 'pdf', { pages: out.getPageCount() });
  }
  fail('Unsupported browser report operation.');
}
