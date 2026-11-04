import { productivityTools } from '../../shared/productivity-tools.js';
import { dataTools } from '../../shared/data-tools.js';
import { reportTools } from '../../shared/report-tools.js';
import { abort, decode, result, fail, base64, unbase64, textBytes } from './utility-common.js';
import { executeCore } from './utility-core.js';
import { safeSvg } from './utility-data.js';
import { runReport, safeHtml, canvasBlob, fileSignature } from './utility-reports.js';
const definitions = [
  ...productivityTools,
  ...dataTools,
  ...reportTools,
  { id: 'docx-preview', defaults: {} },
];
export const supportedToolIds = definitions.map((t) => t.id);
const extras = {
  'create-code': {
    preset: 'text',
    dots: 'square',
    corners: 'square',
    foreground: '#000000',
    background: '#ffffff',
    verify: true,
  },
  'docx-preview': {},
};
function optionsFor(operation, options) {
  const tool = definitions.find((t) => t.id === operation);
  if (!tool) fail('Unsupported browser utility tool.');
  const out = { ...tool.defaults, ...extras[operation], ...options };
  for (const field of tool.fields || []) {
    const v = out[field.key];
    if (field.type === 'number') {
      const n = Number(v);
      if (
        !Number.isFinite(n) ||
        n < field.min ||
        n > field.max ||
        (!field.step && !Number.isInteger(n))
      )
        fail(`${field.label} is out of range.`);
      out[field.key] = n;
    } else if (field.maxLength && typeof v === 'string' && v.length > field.maxLength)
      fail(`${field.label} exceeds its length limit.`);
  }
  return out;
}
async function runWorker(operation, inputs, options, signal) {
  return new Promise((resolve, reject) => {
    abort(signal);
    const worker = new Worker(new URL('./utility-worker.js', import.meta.url), { type: 'module' });
    let done = false;
    const finish = (error, out) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        signal?.removeEventListener('abort', cancel);
        worker.terminate();
        error ? reject(error) : resolve(out);
      },
      cancel = () => finish(new Error('Conversion cancelled.'));
    let timer = setTimeout(
      () => finish(new Error('Browser tool took too long. Simplify the input.')),
      60000,
    );
    signal?.addEventListener('abort', cancel, { once: true });
    worker.onerror = (e) => finish(new Error(e.message || 'Browser tool worker failed.'));
    worker.onmessage = ({ data }) => {
      if (data.ready) {
        if (['test-regex', 'validate-json-schema'].includes(operation)) {
          clearTimeout(timer);
          timer = setTimeout(
            () => finish(new Error('Operation took too long; simplify the pattern or schema.')),
            operation === 'test-regex' ? 1000 : 3000,
          );
        }
        return;
      }
      finish(data.error ? new Error(data.error) : null, data.result);
    };
    worker.postMessage({ operation, inputs, options });
  });
}
async function bitmapCanvas(blob, max = 40000000) {
  let image;
  try {
    image = await createImageBitmap(blob);
  } catch {
    fail('This image format cannot be decoded in this browser.');
  }
  try {
    if (image.width * image.height > max) fail('Image exceeds 40 million pixels.');
    const scale = Math.min(1, 2000 / image.width, 2000 / image.height),
      canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    image.close();
  }
}
async function svgCanvas(blob, width) {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = width || img.naturalWidth || 600;
    canvas.height = width || img.naturalHeight || 600;
    if (canvas.width * canvas.height > 40000000) fail('Image exceeds 40 million pixels.');
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}
async function decodeCodeCanvas(canvas) {
  const { MultiFormatReader, RGBLuminanceSource, HybridBinarizer, BinaryBitmap } =
    await import('@zxing/library');
  const ctx = canvas.getContext('2d'),
    pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data,
    gray = new Uint8ClampedArray(canvas.width * canvas.height);
  for (let i = 0; i < gray.length; i++)
    gray[i] = (pixels[i * 4] * 306 + pixels[i * 4 + 1] * 601 + pixels[i * 4 + 2] * 117) >> 10;
  const reader = new MultiFormatReader();
  try {
    return reader.decodeWithState(
      new BinaryBitmap(
        new HybridBinarizer(new RGBLuminanceSource(gray, canvas.width, canvas.height)),
      ),
    );
  } catch {
    fail('No readable code found. Try a clear image with one large QR code or barcode.');
  } finally {
    reader.reset();
  }
}
async function createCode(inputs, o) {
  const text = decode(inputs[0].bytes).trim();
  if (!text || text.length > 2000) fail('Codes accept 1 to 2,000 characters.');
  if (inputs[0].source !== 'txt' || inputs.length > 2)
    fail('Supply one text input and at most one raster logo.');
  if (!['svg', 'png'].includes(o.format)) fail('Choose PNG or SVG.');
  if (o.kind !== 'qr') {
    const bwip = await import('bwip-js/browser'),
      config = {
        bcid: o.kind,
        text,
        scale: 3,
        height: 20,
        includetext: true,
        textxalign: 'center',
        padding: 12,
      };
    if (o.format === 'svg') return result(bwip.toSVG(config), 'svg');
    const canvas = document.createElement('canvas');
    bwip.toCanvas(canvas, config);
    return result(new Uint8Array(await (await canvasBlob(canvas)).arrayBuffer()), 'png');
  }
  if (!/^#[\da-f]{6}$/i.test(o.foreground) || !/^#[\da-f]{6}$/i.test(o.background))
    fail('Choose valid QR colours.');
  const lum = (h) =>
    [1, 3, 5]
      .map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
      .map((n) => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4))
      .reduce((n, v, i) => n + v * [0.2126, 0.7152, 0.0722][i], 0);
  if (
    (Math.max(lum(o.foreground), lum(o.background)) + 0.05) /
      (Math.min(lum(o.foreground), lum(o.background)) + 0.05) <
    3
  )
    fail('Choose QR colours with at least 3:1 contrast.');
  const [{ default: QRCodeStyling }, { qrPayload }] = await Promise.all([
    import('qr-code-styling'),
    import('../../shared/qr-payload.js'),
  ]);
  const payload = qrPayload(text, o);
  if (payload.length > 2000) fail('QR content exceeds 2,000 characters.');
  let image;
  if (inputs[1]) {
    if (!['png', 'jpg', 'jpeg', 'webp'].includes(inputs[1].source))
      fail('QR logos must be PNG, JPG or WebP.');
    const c = await bitmapCanvas(new Blob([inputs[1].bytes]));
    image =
      'data:image/png;base64,' + base64(new Uint8Array(await (await canvasBlob(c)).arrayBuffer()));
    c.width = c.height = 0;
  }
  const qr = new QRCodeStyling({
      type: 'svg',
      width: o.width,
      height: o.width,
      margin: Math.max(24, Math.round(o.width * 0.06)),
      data: payload,
      ...(image ? { image } : {}),
      qrOptions: { errorCorrectionLevel: 'H' },
      imageOptions: { imageSize: 0.18, margin: 4 },
      dotsOptions: { type: o.dots, color: o.foreground },
      cornersSquareOptions: { type: o.corners, color: o.foreground },
      backgroundOptions: { color: o.background },
    }),
    svg = await qr.getRawData('svg');
  if (!svg) fail('QR generation failed.');
  let png, verified;
  if (o.verify || o.format === 'png') {
    const canvas = await svgCanvas(svg, o.width);
    if (o.verify) {
      try {
        verified = (await decodeCodeCanvas(canvas)).getText() === payload;
      } catch {
        verified = false;
      }
      if (!verified)
        fail(
          'This QR design could not be decoded. Increase its size, simplify styling or remove the logo.',
        );
    }
    png = new Uint8Array(await (await canvasBlob(canvas)).arrayBuffer());
    canvas.width = canvas.height = 0;
  }
  return result(o.format === 'svg' ? new Uint8Array(await svg.arrayBuffer()) : png, o.format, {
    ...(o.verify ? { scanVerified: verified } : {}),
    width: o.width,
    height: o.width,
  });
}
async function imageBase64(input, o) {
  if (o.mode === 'encode') {
    let mime;
    if (input.source === 'svg') {
      safeSvg(input.bytes);
      mime = 'image/svg+xml';
    } else {
      const signature = fileSignature(input.bytes, input.name);
      if (!['jpg', 'png', 'webp', 'gif', 'avif'].includes(signature.detected))
        fail('Input is not a supported image.');
      const canvas = await bitmapCanvas(new Blob([input.bytes]));
      canvas.width = canvas.height = 0;
      mime = 'image/' + (signature.detected === 'jpg' ? 'jpeg' : signature.detected);
    }
    return result((o.dataUri ? `data:${mime};base64,` : '') + base64(input.bytes), 'txt');
  }
  let text = decode(input.bytes).trim();
  const match = text.match(/^data:([^;,]+);base64,([\s\S]*)$/);
  if (match) text = match[2];
  const bytes = unbase64(text),
    signature = fileSignature(bytes, 'decoded.bin'),
    extension = signature.detected;
  if (extension === 'svg') safeSvg(bytes);
  else {
    if (!['jpg', 'png', 'webp', 'gif', 'avif', 'tiff'].includes(extension))
      fail('Decoded data is not a supported image.');
    const canvas = await bitmapCanvas(new Blob([bytes]));
    canvas.width = canvas.height = 0;
  }
  return {
    ...result(bytes, extension),
    mime:
      extension === 'svg' ? 'image/svg+xml' : 'image/' + (extension === 'jpg' ? 'jpeg' : extension),
  };
}
async function diagram(input, o, signal) {
  abort(signal);
  const { renderLocalDiagram } = await import('../tool-runtime/diagram-renderer.js');
  const svg = await renderLocalDiagram(decode(input.bytes), o.theme);
  abort(signal);
  if (o.format === 'svg') return result(svg, 'svg');
  const canvas = await svgCanvas(new Blob([svg], { type: 'image/svg+xml' }));
  return result(new Uint8Array(await (await canvasBlob(canvas)).arrayBuffer()), 'png');
}
export async function convert({ operation, inputs = [], options = {}, onProgress, signal }) {
  abort(signal);
  const o = optionsFor(operation, options);
  if (!inputs.length && !definitions.find((t) => t.id === operation)?.generator)
    fail('Choose an input file.');
  if (['compare-text', 'compare-json'].includes(operation) && inputs.length > 2)
    fail('Compare at most two files, original first.');
  const prepared = [];
  let total = 0;
  for (const input of inputs) {
    if (!(input.file instanceof Blob)) fail('Input file bytes are unavailable.');
    total += input.file.size;
    if (total > 100 * 1024 * 1024) fail('Inputs exceed 100 MB.');
    prepared.push({
      name: input.name || input.file.name || 'input.txt',
      source: input.source || 'txt',
      bytes: new Uint8Array(await input.file.arrayBuffer()),
    });
  }
  if (!prepared.length)
    prepared.push({ name: 'input.txt', source: 'txt', bytes: new Uint8Array() });
  abort(signal);
  onProgress?.({ stage: 'Processing in your browser', progress: null });
  let out;
  if (operation === 'create-code') out = await createCode(prepared, o);
  else if (operation === 'read-code') {
    const canvas = await bitmapCanvas(inputs[0].file),
      found = await decodeCodeCanvas(canvas);
    out = result(found.getText(), 'txt', { format: String(found.getBarcodeFormat()) });
    canvas.width = canvas.height = 0;
  } else if (operation === 'image-base64') out = await imageBase64(prepared[0], o);
  else if (operation === 'diagram-studio') out = await diagram(prepared[0], o, signal);
  else if (reportTools.some((t) => t.id === operation) || operation === 'docx-preview')
    out = await runReport(operation, prepared, o, signal);
  else if (typeof Worker !== 'undefined') out = await runWorker(operation, prepared, o, signal);
  else {
    if (['test-regex', 'validate-json-schema'].includes(operation))
      fail('This bounded tool requires browser Web Workers.');
    out = await executeCore(operation, prepared, o, signal);
  }
  abort(signal);
  if (out.mime === 'text/html' && operation === 'markdown-editor')
    out.bytes = textBytes(await safeHtml(decode(out.bytes)));
  if (out.bytes.length > 200 * 1024 * 1024) fail('Result exceeds 200 MB.');
  const blob = new Blob([out.bytes], { type: out.mime }),
    details = { ...out.details };
  if (
    operation !== 'generate-password' &&
    ['json', 'txt', 'csv', 'yaml', 'xml', 'toml', 'sql', 'md'].includes(out.extension) &&
    out.bytes.length < 65536
  ) {
    try {
      const preview = decode(out.bytes);
      if (!preview.includes('\0')) {
        details.preview = preview.slice(0, 4000);
        details.previewTruncated = preview.length > 4000;
      }
    } catch {
      /* Encoded byte output need not be UTF-8. */
    }
  }
  onProgress?.({ stage: 'Result ready', progress: 100 });
  return { blob, filename: `${operation}.${out.extension}`, mime: out.mime, details };
}
export { convertDataPair } from './utility-pairs.js';
