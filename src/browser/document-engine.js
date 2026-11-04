import { safeUnzip } from './utility-common.js';
import { MIME, checkAbort, result } from './image-common.js';
import { textPdf } from './pdf-engine.js';
const formats = {
  md: 'markdown',
  markdown: 'markdown',
  txt: 'plain',
  html: 'html',
  htm: 'html',
  docx: 'docx',
  rtf: 'rtf',
  odt: 'odt',
  epub: 'epub',
};
export function escapeHtml(text) {
  return text.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}
export async function sanitizeHtml(html) {
  const { default: DOMPurify } = await import('dompurify');
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: [
      'script',
      'style',
      'link',
      'meta',
      'base',
      'iframe',
      'object',
      'embed',
      'form',
      'input',
      'button',
      'video',
      'audio',
      'source',
    ],
    FORBID_ATTR: ['style', 'srcset'],
    ALLOWED_URI_REGEXP: /^(?:#|data:image\/(?:png|jpeg|gif|webp);base64,)/i,
  });
}
export async function plainHtml(html) {
  const safe = await sanitizeHtml(html);
  const doc = new DOMParser().parseFromString(
    safe.replace(/<\/(?:p|div|h[1-6]|li|tr|blockquote)>/gi, '\n'),
    'text/html',
  );
  return doc.body.textContent.replace(/\n{3,}/g, '\n\n').trim();
}
export function validateDocumentArchive(bytes) {
  return safeUnzip(bytes);
}
export async function safeDocumentInput(file, source) {
  if (file.size > 10 * 1024 * 1024)
    throw new Error('Semantic document conversion accepts one file up to 10 MB.');
  if (['docx', 'odt', 'epub'].includes(source)) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const entries = validateDocumentArchive(bytes);
    if (source === 'docx' && !entries['word/document.xml'])
      throw new Error('Not a Word DOCX document.');
    for (const [name, data] of Object.entries(entries)) {
      if (!/\.(?:rels|xml|html|xhtml|opf)$/i.test(name)) continue;
      const text = new TextDecoder().decode(data);
      if (/\.rels$/i.test(name) && /TargetMode\s*=\s*["']External["']/i.test(text))
        throw new Error('Document includes external relationships. Remove linked resources first.');
      if (/<!DOCTYPE|<!ENTITY|<\s*(?:script|iframe|object|embed)\b|\bon\w+\s*=/i.test(text))
        throw new Error('Document contains embedded active content.');
    }
    return;
  }
  const text = await file.text();
  if (text.includes('\0')) throw new Error('Input contains binary data instead of document text.');
  if (
    ['html', 'htm', 'md', 'markdown'].includes(source) &&
    (/<\s*(?:script|iframe|object|embed|base|form)\b|\bon\w+\s*=|javascript\s*:|@import|url\(\s*["']?\s*(?:https?:|\/\/)/i.test(
      text,
    ) ||
      /!\[[^\]]*\]\(\s*(?:https?:|\/\/)/i.test(text) ||
      /<(?:img|link|source)\b[^>]*(?:src|href)\s*=\s*["']\s*(?:https?:|\/\/)/i.test(text))
  )
    throw new Error(
      'Remove scripts, active content and external resources before semantic conversion.',
    );
  if (source === 'rtf' && /\\(?:object|objdata|field|file|datastore)\b/i.test(text))
    throw new Error('Remove RTF fields and embedded objects before conversion.');
}
export async function extractText(file, source) {
  if (source === 'txt') return file.text();
  if (['html', 'htm'].includes(source)) return plainHtml(await file.text());
  if (['md', 'markdown'].includes(source)) {
    const { marked } = await import('marked');
    return plainHtml(marked.parse(await file.text()));
  }
  if (source === 'docx') {
    await safeDocumentInput(file, source);
    const { default: mammoth } = await import('mammoth/mammoth.browser.js');
    return (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value;
  }
  throw new Error('Text extraction accepts TXT, Markdown, HTML or DOCX.');
}
export async function semanticConvert(file, source, target, { signal, onProgress } = {}) {
  checkAbort(signal);
  source = source === 'markdown' ? 'md' : source === 'htm' ? 'html' : source;
  target = target === 'markdown' ? 'md' : target === 'htm' ? 'html' : target;
  await safeDocumentInput(file, source);
  if (target === 'txt' && ['txt', 'md', 'html', 'docx'].includes(source))
    return result(await extractText(file, source), 'converted.txt');
  if (target === 'pdf') return textPdf(await extractText(file, source));
  if (target === 'html' && ['md', 'html', 'docx', 'txt'].includes(source)) {
    let html;
    if (source === 'docx') {
      const { default: mammoth } = await import('mammoth/mammoth.browser.js');
      const converted = await mammoth.convertToHtml(
        { arrayBuffer: await file.arrayBuffer() },
        { convertImage: mammoth.images.imgElement(async () => ({ src: '' })) },
      );
      html = converted.value;
    } else if (source === 'md') {
      const { marked } = await import('marked');
      html = marked.parse(await file.text());
    } else
      html = source === 'txt' ? `<pre>${escapeHtml(await file.text())}</pre>` : await file.text();
    html = await sanitizeHtml(html);
    return result(
      `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; form-action 'none'"><title>Converted document</title></head><body>${html}</body></html>`,
      'converted.html',
      { semantic: true },
    );
  }
  if (!formats[source] || !formats[target])
    throw new Error('This semantic document format is not supported in the browser.');
  if (source === 'txt') {
    file = new Blob([`<pre>${escapeHtml(await file.text())}</pre>`], {
      type: 'text/html',
    });
    source = 'html';
  }
  onProgress?.({ stage: 'Loading local document engine', progress: 5 });
  const [{ createPandocInstance }, { loadPandocWasm }] = await Promise.all([
    import('../../node_modules/pandoc-wasm/src/core.js'),
    import('../tool-runtime/pandoc-loader.js'),
  ]);
  checkAbort(signal);
  const pandoc = await createPandocInstance(await loadPandocWasm()),
    input = `input.${source}`,
    output = `converted.${target}`;
  onProgress?.({ stage: 'Converting document structure', progress: 30 });
  const converted = await pandoc.convert(
    {
      from: formats[source],
      to: formats[target],
      'input-files': [input],
      'output-file': output,
      standalone: true,
      sandbox: true,
    },
    '',
    { [input]: file },
  );
  checkAbort(signal);
  const out = converted.files[output];
  if (!out?.size) throw new Error(converted.stderr || 'Document conversion produced no output.');
  if (target === 'html' || target === 'epub') {
    const { safeDocumentResult } = await import('../tool-runtime/safe-document.js'),
      safe = await safeDocumentResult({
        bytes: new Uint8Array(await out.arrayBuffer()),
        mime: MIME[target],
      });
    return result(safe.bytes, output, {
      warnings: converted.warnings,
      semantic: true,
    });
  }
  return result(out, output, { warnings: converted.warnings, semantic: true });
}
export async function ocrDocument(inputs, o, signal, onProgress) {
  checkAbort(signal);
  const [{ createWorker, OEM }, { openPdf, renderPage }, { PDFDocument }] = await Promise.all([
    import('tesseract.js'),
    import('./pdf-engine.js'),
    import('pdf-lib'),
  ]);
  const file = inputs[0].file,
    isPdf = inputs[0].source === 'pdf';
  let doc, worker;
  const pdfs = [],
    texts = [];
  try {
    if (isPdf) {
      doc = await openPdf(file);
      if (doc.numPages > 20) throw new Error('OCR allows up to 20 PDF pages.');
    }
    worker = await createWorker('eng', OEM.LSTM_ONLY, {
      workerPath: '/tool-runtime/ocr/worker.min.js',
      corePath: '/tool-runtime/ocr/',
      langPath: '/tool-runtime/ocr/',
      gzip: true,
      cacheMethod: 'none',
      workerBlobURL: false,
      logger: (m) => {
        if (signal?.aborted) return;
        if (m.status === 'recognizing text')
          onProgress?.({
            stage: 'Recognizing English text',
            progress: Math.round(m.progress * 90),
          });
      },
    });
    checkAbort(signal);
    const stop = () => void worker?.terminate();
    signal?.addEventListener('abort', stop, { once: true });
    try {
      let total = 0;
      for (let i = 0; i < (doc?.numPages || 1); i++) {
        checkAbort(signal);
        const image = doc ? await renderPage(doc, i + 1, 2, signal) : file;
        if (doc) {
          total += image.width * image.height;
          if (total > 100_000_000) throw new Error('OCR rendering exceeds 100 million pixels.');
        }
        const imageInput = doc
          ? await (image.convertToBlob
              ? image.convertToBlob({ type: 'image/png' })
              : new Promise((resolve) => image.toBlob(resolve)))
          : image;
        const { data } = await worker.recognize(
          imageInput,
          { pdfTitle: 'Searchable document' },
          { text: true, pdf: o.format === 'pdf' },
        );
        texts.push(data.text || '');
        if (o.format === 'pdf') {
          if (!data.pdf?.length) throw new Error('OCR engine did not produce a searchable page.');
          pdfs.push(data.pdf);
        }
      }
    } finally {
      signal?.removeEventListener('abort', stop);
    }
    if (!texts.some((t) => t.trim()))
      throw new Error('OCR could not recognize English text in this document.');
    if (o.format === 'txt')
      return result(texts.join('\n\n').trim() + '\n', 'recognized.txt', {
        language: 'eng',
        pages: texts.length,
      });
    const pdf = await PDFDocument.create();
    for (const bytes of pdfs) {
      const source = await PDFDocument.load(bytes);
      for (const page of await pdf.copyPages(source, source.getPageIndices())) pdf.addPage(page);
    }
    return result(await pdf.save(), 'searchable.pdf', {
      language: 'eng',
      pages: pdf.getPageCount(),
      searchable: true,
    });
  } finally {
    await worker?.terminate();
    await doc?.loadingTask.destroy();
  }
}
