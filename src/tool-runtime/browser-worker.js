import { loadPandocWasm } from './pandoc-loader.js';
import { defaultOptions as jpegDefaults } from '@jsquash/jpeg/meta.js';
import { defaultOptions as webpDefaults } from '@jsquash/webp/meta.js';
import { zipSync } from 'fflate';
import { createPandocInstance } from '../../node_modules/pandoc-wasm/src/core.js';
const engines = {};
async function encodeImage(image, format, quality) {
  if (format === 'png') {
    const canvas = new OffscreenCanvas(image.width, image.height);
    canvas.getContext('2d').putImageData(image, 0, 0);
    return new Uint8Array(await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer());
  }
  const codec = format === 'jpg' ? 'jpeg' : 'webp',
    entry = codec === 'jpeg' ? 'mozjpeg_enc.js' : 'webp_enc.js';
  if (!engines[codec]) {
    const url = `/tool-runtime/${codec}/codec/enc/${entry}`,
      factory = (await import(/* @vite-ignore */ url)).default;
    engines[codec] = await factory({
      noInitialRun: true,
      locateFile: (name) => `/tool-runtime/${codec}/codec/enc/${name}`,
    });
  }
  const module = engines[codec],
    options = { ...(codec === 'jpeg' ? jpegDefaults : webpDefaults), quality },
    view = module.encode(image.data, image.width, image.height, options);
  if (!view) throw new Error('Image codec could not encode this image.');
  return new Uint8Array(view).slice();
}
async function compress(file, o) {
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/avif'].includes(file.type))
    throw new Error(
      'Browser compression accepts PNG, JPEG, WebP and AVIF. Use local server processing for TIFF or other formats.',
    );
  const bitmap = await createImageBitmap(file),
    width = bitmap.width,
    height = bitmap.height;
  if (width * height > 40_000_000) {
    bitmap.close();
    throw new Error('Image exceeds 40 million pixels.');
  }
  let best;
  const target = o.targetKB * 1024;
  for (let attempt = 0; attempt < (o.allowResize ? 5 : 1); attempt++) {
    const ratio = 0.78 ** attempt,
      w = Math.max(1, Math.round(width * ratio)),
      h = Math.max(1, Math.round(height * ratio)),
      canvas = new OffscreenCanvas(w, h),
      ctx = canvas.getContext('2d');
    if (o.output === 'jpg') {
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, w, h);
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    const image = ctx.getImageData(0, 0, w, h);
    for (const quality of o.output === 'png' ? [100] : [90, 72, 54, 36, 20]) {
      const bytes = await encodeImage(image, o.output, quality),
        result = { bytes, width: w, height: h, quality };
      if (!best || bytes.length < best.bytes.length) best = result;
      if (bytes.length <= target) {
        bitmap.close();
        return { ...result, targetMet: true };
      }
    }
  }
  bitmap.close();
  return { ...best, targetMet: false };
}
self.onmessage = async (event) => {
  try {
    const { kind, files, options: o, text } = event.data;
    if (kind === 'image') {
      let total = 0;
      for (const f of files) total += f.size;
      if (!files.length || files.length > 20 || total > 100 * 1024 * 1024)
        throw new Error('Choose up to 20 images within 100 MB total.');
      const entries = {},
        report = [];
      for (const [i, file] of files.entries()) {
        self.postMessage({ stage: `Compressing image ${i + 1} of ${files.length}` });
        const result = await compress(file, o),
          name = `${i + 1}-${file.name.replace(/\.[^.]+$/, '').replace(/[^\w-]/g, '_')}.${o.output}`;
        entries[name] = result.bytes;
        report.push({
          file: file.name,
          output: name,
          inputBytes: file.size,
          outputBytes: result.bytes.length,
          targetMet: result.targetMet,
          width: result.width,
          height: result.height,
        });
        if (Object.values(entries).reduce((n, b) => n + b.length, 0) > 150 * 1024 * 1024)
          throw new Error('Batch output exceeds 150 MB.');
      }
      const single = files.length === 1,
        entry = Object.keys(entries)[0];
      entries['compression-report.json'] = new TextEncoder().encode(
        JSON.stringify(report, null, 2),
      );
      const bytes = single ? entries[entry] : zipSync(entries, { level: 3 });
      self.postMessage(
        {
          result: {
            bytes,
            filename: single ? entry : 'optimized-images.zip',
            mime: single ? `image/${o.output === 'jpg' ? 'jpeg' : o.output}` : 'application/zip',
            report,
          },
        },
        [bytes.buffer],
      );
    } else if (kind === 'document') {
      const file = files[0] || new File([text], 'input.md', { type: 'text/markdown' });
      if (files.length > 1 || file.size > 10 * 1024 * 1024)
        throw new Error('Browser document conversion accepts one file up to 10 MB.');
      const ext = file.name.split('.').pop().toLowerCase(),
        formats = {
          md: 'markdown',
          markdown: 'markdown',
          html: 'html',
          htm: 'html',
          docx: 'docx',
          rtf: 'rtf',
          odt: 'odt',
        },
        from = formats[ext];
      if (!from) throw new Error('Use Markdown, HTML, DOCX, RTF or ODT.');
      self.postMessage({ stage: 'Loading local document engine…' });
      const pandoc = await createPandocInstance(await loadPandocWasm()),
        filename = `converted.${o.format}`,
        result = await pandoc.convert(
          {
            from,
            to: formats[o.format] || o.format,
            'input-files': ['input.' + ext],
            'output-file': filename,
            standalone: true,
            sandbox: true,
          },
          '',
          { ['input.' + ext]: file },
        );
      const out = result.files[filename];
      if (!out?.size) throw new Error(result.stderr || 'Document conversion produced no output.');
      if (out.size > 200 * 1024 * 1024) throw new Error('Output exceeds 200 MB.');
      const bytes = new Uint8Array(await out.arrayBuffer());
      self.postMessage(
        {
          result: {
            bytes,
            filename,
            mime:
              {
                docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                html: 'text/html',
                md: 'text/markdown',
                odt: 'application/vnd.oasis.opendocument.text',
                epub: 'application/epub+zip',
                rtf: 'application/rtf',
              }[o.format] || 'application/octet-stream',
            warnings: result.warnings,
          },
        },
        [bytes.buffer],
      );
    }
  } catch (error) {
    self.postMessage({ error: error.message || String(error) });
  }
};
