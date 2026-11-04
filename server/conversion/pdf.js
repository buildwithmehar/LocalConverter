import { createCanvas, DOMMatrix, ImageData, Path2D } from '@napi-rs/canvas';
import { zipSync } from 'fflate';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { LIMITS, fail, checkAbort } from './common.js';
globalThis.DOMMatrix ??= DOMMatrix;
globalThis.ImageData ??= ImageData;
globalThis.Path2D ??= Path2D;
const packageUrl = import.meta.resolve('pdfjs-dist/package.json');
const assetRoots = {
  cMapUrl: new URL('./cmaps/', packageUrl),
  standardFontDataUrl: new URL('./standard_fonts/', packageUrl),
  wasmUrl: new URL('./wasm/', packageUrl),
};
class LocalPdfAssets {
  async fetch({ kind, filename }) {
    if (
      !Object.hasOwn(assetRoots, kind) ||
      !/^[A-Za-z0-9_-][A-Za-z0-9_.-]*$/.test(filename) ||
      filename.includes('..')
    )
      fail('Unsupported PDF asset name.');
    return new Uint8Array(await fs.readFile(new URL(filename, assetRoots[kind])));
  }
}
let pdfjs;
export async function openPdf(buffer) {
  if (buffer.subarray(0, 5).toString() !== '%PDF-') fail('File is not a PDF.');
  pdfjs ??= await import('pdfjs-dist/legacy/build/pdf.mjs');
  return pdfjs.getDocument({
    data: new Uint8Array(buffer),
    disableFontFace: true,
    useSystemFonts: false,
    isEvalSupported: false,
    useWorkerFetch: false,
    verbosity: 0,
    maxImageSize: LIMITS.pixels,
    canvasMaxAreaInBytes: LIMITS.pixels * 4,
    ...Object.fromEntries(
      Object.entries(assetRoots).map(([key, url]) => [
        key,
        fileURLToPath(url).replaceAll('\\', '/'),
      ]),
    ),
    BinaryDataFactory: LocalPdfAssets,
  }).promise;
}
export async function convertPdf(buffer, target, options, signal, onProgress) {
  const doc = await openPdf(buffer);
  try {
    if (doc.numPages > LIMITS.pages) fail('PDF exceeds 100 pages.');
    if (options.page > doc.numPages) fail('Selected page does not exist.');
    const pages = options.page
      ? [options.page]
      : Array.from({ length: doc.numPages }, (_, i) => i + 1);
    const texts = [],
      files = {};
    let renderedPixels = 0,
      encodedBytes = 0;
    for (let i = 0; i < pages.length; i++) {
      checkAbort(signal);
      const page = await doc.getPage(pages[i]);
      if (target === 'txt') {
        const content = await page.getTextContent();
        texts.push(content.items.map((item) => item.str ?? '').join(' '));
      } else {
        const viewport = page.getViewport({ scale: options.scale ?? 2 });
        const pixels = Math.ceil(viewport.width) * Math.ceil(viewport.height);
        renderedPixels += pixels;
        if (pixels > LIMITS.pixels || renderedPixels > 100_000_000)
          fail('PDF rendering exceeds pixel limits: 40 million per page, 100 million total.');
        const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
        const factory = {
          create(w, h) {
            const c = createCanvas(w, h);
            return { canvas: c, context: c.getContext('2d') };
          },
          reset(o, w, h) {
            o.canvas.width = w;
            o.canvas.height = h;
          },
          destroy(o) {
            o.canvas.width = 0;
            o.canvas.height = 0;
            o.canvas = null;
            o.context = null;
          },
        };
        const rendering = page.render({
          canvasContext: canvas.getContext('2d'),
          viewport,
          canvasFactory: factory,
          annotationMode: 0,
        });
        const cancel = () => rendering.cancel();
        signal?.addEventListener('abort', cancel, { once: true });
        try {
          await rendering.promise;
        } finally {
          signal?.removeEventListener('abort', cancel);
        }
        let data = canvas.toBuffer('image/png');
        if (target === 'jpg')
          data = await sharp(data).flatten({ background: '#fff' }).jpeg({ quality: 90 }).toBuffer();
        encodedBytes += data.length;
        if (encodedBytes > LIMITS.outputBytes) fail('PDF images exceed the 200 MB output limit.');
        files[`page-${String(pages[i]).padStart(3, '0')}.${target}`] = data;
      }
      onProgress?.({
        stage: `Processed page ${i + 1} of ${pages.length}`,
        progress: Math.round(((i + 1) / pages.length) * 100),
      });
      page.cleanup();
    }
    if (target === 'txt') {
      const text = texts.join('\n\n');
      if (!text.trim()) fail('PDF contains no selectable text. OCR is unavailable.');
      return { buffer: Buffer.from(text), extension: 'txt' };
    }
    return pages.length === 1
      ? { buffer: Buffer.from(Object.values(files)[0]), extension: target }
      : { buffer: Buffer.from(zipSync(files)), extension: 'zip' };
  } finally {
    await doc.loadingTask.destroy();
  }
}
