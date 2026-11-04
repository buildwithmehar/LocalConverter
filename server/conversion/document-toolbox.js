import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { documentTools } from '../../shared/document-tools.js';
import { readInput, runProcess, checkAbort, fail, textInput, safeSvg } from './common.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const python = path.join(root, '.tools/python/Scripts/python.exe');
const script = path.join(root, 'server/toolbox/document_worker.py');
async function exists(p) {
  return fs
    .stat(p)
    .then((s) => s.isFile())
    .catch(() => false);
}
async function nativeEngine(name) {
  const choices =
    name === 'LibreOffice'
      ? [
          path.join(root, '.tools/native/libreoffice/program/soffice.com'),
          path.join(root, '.tools/native/libreoffice/program/soffice.exe'),
          'C:/Program Files/LibreOffice/program/soffice.com',
        ]
      : [
          path.join(root, '.tools/native/calibre/PFiles64/Calibre2/ebook-convert.exe'),
          path.join(root, '.tools/native/calibre/Calibre2/ebook-convert.exe'),
          path.join(root, '.tools/native/calibre/ebook-convert.exe'),
          'C:/Program Files/Calibre2/ebook-convert.exe',
        ];
  for (const p of choices) if (await exists(p)) return p;
  return null;
}
function settings(def, supplied) {
  if (!supplied || typeof supplied !== 'object' || Array.isArray(supplied))
    fail('Choose valid document settings.');
  for (const key of Object.keys(supplied))
    if (!Object.hasOwn(def.defaults, key)) fail(`Unsupported setting: ${key}`);
  const o = { ...def.defaults, ...supplied };
  for (const f of def.fields) {
    const v = o[f.key];
    if (f.type === 'number' && (!Number.isInteger(v) || v < f.min || v > f.max))
      fail(`Invalid ${f.label}.`);
    if (f.type === 'select' && !f.options.some(([value]) => value === v))
      fail(`Invalid ${f.label}.`);
    if (f.type === 'checkbox' && typeof v !== 'boolean') fail(`Invalid ${f.label}.`);
    if (
      ['text', 'textarea', 'password'].includes(f.type) &&
      (typeof v !== 'string' || v.length > (f.maxLength || 10000))
    )
      fail(`Invalid ${f.label}.`);
  }
  return o;
}
async function pythonJob(manifest, signal) {
  if (!(await exists(python)))
    fail('Document Python engine is missing. Configure .tools/python first.');
  const file = path.join(manifest.outputDir, `document-${randomUUID()}.json`);
  await fs.writeFile(file, JSON.stringify(manifest), { mode: 0o600 });
  try {
    const stdout = await runProcess(python, [script, file], { signal, timeout: 170000, cwd: root });
    const lines = stdout.trim().split(/\r?\n/);
    const result = JSON.parse(lines.at(-1));
    if (result.error) fail(result.error);
    return result;
  } finally {
    await fs.rm(file, { force: true });
  }
}
async function htmlRender(inputs, outputDir, o, signal) {
  if (!['html', 'htm'].includes(inputs[0].source))
    fail('Upload the HTML document first, followed by local assets.');
  const { chromium } = await import('playwright');
  const assetDir = path.join(outputDir, `html-assets-${randomUUID()}`);
  await fs.mkdir(assetDir);
  const names = new Set(),
    assets = new Map();
  let html;
  for (const [n, input] of inputs.entries()) {
    const data = await readInput(input.path),
      ext = input.source;
    if (
      ['html', 'htm'].includes(ext) &&
      !/<(?:!doctype\s+html|html|body|head|main|section|div|p|h[1-6]|table)\b/i.test(
        textInput(data),
      )
    )
      fail('HTML input must contain valid HTML document or content tags.');
    if (ext === 'css') textInput(data);
    if (ext === 'svg') safeSvg(data);
    if (
      ext === 'png' &&
      !data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    )
      fail('PNG asset has an invalid signature.');
    if (['jpg', 'jpeg'].includes(ext) && (data[0] !== 255 || data[1] !== 216 || data[2] !== 255))
      fail('JPEG asset has an invalid signature.');
    if (
      ['woff', 'woff2'].includes(ext) &&
      data.subarray(0, 4).toString() !== (ext === 'woff' ? 'wOFF' : 'wOF2')
    )
      fail('Font asset has an invalid signature.');
    const name = path
      .basename(String(input.name || path.basename(input.path)))
      .replace(/[^a-zA-Z0-9_. -]/g, '_');
    if (!name || name === '.' || name === '..' || names.has(name.toLowerCase()))
      fail('HTML assets need unique simple filenames.');
    names.add(name.toLowerCase());
    const target = path.join(assetDir, name);
    await fs.copyFile(input.path, target);
    assets.set(name, target);
    if (n === 0) html = name;
  }
  const browser = await chromium.launch({ headless: true });
  let context;
  const stop = () => {
    void browser.close();
  };
  signal?.addEventListener('abort', stop, { once: true });
  try {
    context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: o.width, height: o.height },
      serviceWorkers: 'block',
      acceptDownloads: false,
    });
    const origin = 'https://local-document.invalid';
    const types = {
      html: 'text/html',
      htm: 'text/html',
      css: 'text/css',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      svg: 'image/svg+xml',
      woff: 'font/woff',
      woff2: 'font/woff2',
    };
    await context.route('**/*', async (route) => {
      try {
        const url = new URL(route.request().url()),
          name = decodeURIComponent(url.pathname.slice(1));
        if (url.origin !== origin || !assets.has(name) || route.request().method() !== 'GET')
          return route.abort('blockedbyclient');
        return route.fulfill({
          status: 200,
          contentType:
            types[path.extname(name).slice(1).toLowerCase()] || 'application/octet-stream',
          body: await fs.readFile(assets.get(name)),
          headers: {
            'Content-Security-Policy':
              "default-src 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
          },
        });
      } catch {
        return route.abort('blockedbyclient');
      }
    });
    const page = await context.newPage();
    await page.goto(origin + '/' + encodeURIComponent(html), { waitUntil: 'load', timeout: 20000 });
    const p = path.join(outputDir, o.format === 'pdf' ? 'rendered.pdf' : 'screenshot.png');
    if (o.format === 'pdf') {
      await page.pdf({ path: p, format: 'A4', printBackground: true, preferCSSPageSize: true });
      const { PDFDocument } = await import('pdf-lib');
      const pdf = await PDFDocument.load(await fs.readFile(p));
      if (pdf.getPageCount() > 100) fail('Rendered HTML exceeds 100 PDF pages.');
    } else await page.screenshot({ path: p, type: 'png', fullPage: false, timeout: 20000 });
    checkAbort(signal);
    return {
      path: p,
      filename: path.basename(p),
      mime: o.format === 'pdf' ? 'application/pdf' : 'image/png',
      details: { networkAccess: false, javascript: false },
    };
  } finally {
    signal?.removeEventListener('abort', stop);
    await browser.close();
  }
}
async function ocr(manifest, signal, onProgress) {
  const langPath = path.join(root, '.tools/models/document');
  if (!(await exists(path.join(langPath, 'eng.traineddata.gz'))))
    fail('Local English OCR model is missing: .tools/models/document/eng.traineddata.gz.');
  const { createWorker, OEM } = await import('tesseract.js');
  const rendered = await pythonJob({ ...manifest, operation: 'ocr-render' }, signal);
  const worker = await createWorker('eng', OEM.LSTM_ONLY, {
    langPath,
    gzip: true,
    cacheMethod: 'none',
    logger: (m) => {
      if (m.status === 'recognizing text')
        onProgress?.({ stage: 'Recognizing English text', progress: Math.round(m.progress * 90) });
    },
  });
  const stop = () => {
    void worker.terminate();
  };
  signal?.addEventListener('abort', stop, { once: true });
  let text = '';
  const pdfs = [];
  try {
    for (const [i, p] of rendered.pages.entries()) {
      checkAbort(signal);
      const { data } = await worker.recognize(
        p,
        { pdfTitle: 'Searchable document' },
        { text: true, pdf: true },
      );
      text += `\n${data.text}\n`;
      if (manifest.options.format === 'pdf') {
        if (!data.pdf?.length) fail('OCR engine did not produce a searchable page.');
        const output = path.join(manifest.outputDir, `ocr-page-${i + 1}.pdf`);
        await fs.writeFile(output, Buffer.from(data.pdf));
        pdfs.push(output);
      }
    }
  } finally {
    signal?.removeEventListener('abort', stop);
    await worker.terminate();
  }
  if (!text.trim()) fail('OCR could not recognize any English text in this document.');
  if (manifest.options.format === 'pdf')
    return pythonJob({ ...manifest, operation: 'ocr-finish', ocrPages: pdfs }, signal);
  const p = path.join(manifest.outputDir, 'recognized.txt');
  await fs.writeFile(p, text.trim() + '\n');
  return { path: p, filename: 'recognized.txt', mime: 'text/plain' };
}
export async function convertDocumentTool({
  operation,
  inputs,
  outputDir,
  options = {},
  signal,
  onProgress,
}) {
  checkAbort(signal);
  const def = documentTools.find((t) => t.id === operation);
  if (!def) fail('Unsupported document tool.');
  if (
    !Array.isArray(inputs) ||
    inputs.length < (def.minFiles || 1) ||
    inputs.length > 20 ||
    (!def.multiple && inputs.length !== 1)
  )
    fail('Choose the required number of document files.');
  if (operation === 'compare-pdfs' && inputs.length !== 2)
    fail('Comparison requires exactly two PDFs.');
  const o = settings(def, options);
  if (operation === 'stamp-pdf' && inputs.length !== (o.kind === 'overlay' ? 2 : 1))
    fail('Use two PDFs for overlay; other stamps require one PDF.');
  const base = path.resolve(outputDir);
  await fs.mkdir(base, { recursive: true });
  let bytes = 0;
  for (const input of inputs) {
    const resolved = path.resolve(input.path);
    if (resolved === base || !resolved.startsWith(base + path.sep))
      fail('Document inputs must be inside the conversion job directory.');
    if (!def.accept.includes(input.source)) fail('Unsupported input format for this tool.');
    bytes += (await readInput(resolved)).length;
  }
  if (bytes > 100 * 1024 * 1024) fail('Combined document inputs exceed 100 MB.');
  onProgress?.({ stage: 'Processing document locally', progress: 5 });
  const manifest = {
    operation,
    inputs,
    outputDir: base,
    options: o,
    native: {
      LibreOffice: await nativeEngine('LibreOffice'),
      Calibre: await nativeEngine('Calibre'),
    },
  };
  let result;
  if (operation === 'render-html') result = await htmlRender(inputs, base, o, signal);
  else if (operation === 'ocr-document') result = await ocr(manifest, signal, onProgress);
  else result = await pythonJob(manifest, signal);
  const p = path.resolve(result.path || '');
  if (!p.startsWith(base + path.sep) || inputs.some((i) => path.resolve(i.path) === p))
    fail('Document engine returned an invalid output path.');
  const stat = await fs.stat(p);
  if (!stat.isFile() || !stat.size || stat.size > 200 * 1024 * 1024)
    fail('Document output is empty or exceeds 200 MB.');
  return result;
}
