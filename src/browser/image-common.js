export const MIME = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
  tiff: 'image/tiff',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
  txt: 'text/plain',
  md: 'text/markdown',
  html: 'text/html',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  odt: 'application/vnd.oasis.opendocument.text',
  rtf: 'application/rtf',
  epub: 'application/epub+zip',
  json: 'application/json',
  csv: 'text/csv',
  zip: 'application/zip',
};
export function checkAbort(signal) {
  if (signal?.aborted) throw new DOMException('Conversion cancelled.', 'AbortError');
}
export function result(data, filename, details) {
  const ext = filename.split('.').pop(),
    mime = MIME[ext] || 'application/octet-stream';
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
  if (blob.size > 200 * 1024 * 1024) throw new Error('Output exceeds 200 MB.');
  return { blob, filename, mime, details };
}
export function stem(name = 'converted') {
  return (
    name
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 100) || 'converted'
  );
}
export function pixels(width, height) {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width * height > 40_000_000
  )
    throw new Error('Image dimensions must be positive whole numbers within 40 million pixels.');
}
export function canvas(width, height) {
  pixels(width, height);
  const c =
    typeof OffscreenCanvas === 'function'
      ? new OffscreenCanvas(width, height)
      : Object.assign(document.createElement('canvas'), { width, height });
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('This browser does not support Canvas image processing.');
  return { canvas: c, ctx };
}
export async function canvasBlob(c, type = 'image/png', quality = 0.9) {
  const blob = c.convertToBlob
    ? await c.convertToBlob({ type, quality })
    : await new Promise((resolve, reject) =>
        c.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Image encoding failed.'))),
          type,
          quality,
        ),
      );
  if (blob.type !== type) throw new Error(`This browser cannot encode ${type}.`);
  return blob;
}
export function drawFit(ctx, image, width, height, fit = 'contain', background = 'transparent') {
  if (background !== 'transparent') {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
  }
  const iw = image.width,
    ih = image.height;
  const scale =
    fit === 'cover' ? Math.max(width / iw, height / ih) : Math.min(width / iw, height / ih);
  const w = fit === 'fill' ? width : iw * scale,
    h = fit === 'fill' ? height : ih * scale;
  ctx.drawImage(image, (width - w) / 2, (height - h) / 2, w, h);
}
export async function zipResult(entries, filename, details) {
  const { zipSync } = await import('fflate');
  return result(zipSync(entries, { level: 3 }), filename, details);
}
export function parsePages(value, count, { unique = true } = {}) {
  if (!String(value || '').trim()) return Array.from({ length: count }, (_, i) => i);
  const out = [];
  for (const token of String(value).split(',')) {
    const m = token.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!m) throw new Error('Use page numbers and ranges, such as 1-3, 5.');
    const a = +m[1],
      b = +(m[2] || m[1]);
    if (a < 1 || b < a || b > count)
      throw new Error(`Page range must stay between 1 and ${count}.`);
    for (let n = a; n <= b; n++) {
      if (out.includes(n - 1)) {
        if (!unique) throw new Error('Each page may appear only once.');
      } else out.push(n - 1);
    }
  }
  return out;
}
