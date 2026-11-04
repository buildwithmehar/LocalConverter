import fs from 'node:fs/promises';
import { build } from 'esbuild';
import { gzip } from 'node:zlib';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { prepareSpeechModel } from './prepare-speech-model.mjs';
const compress = promisify(gzip);
async function ensureModel(file, url) {
  if (
    await fs
      .stat(file)
      .then((s) => s.size > 0)
      .catch(() => false)
  )
    return;
  const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error('Browser model download failed: ' + url);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > 32 * 1024 * 1024)
    throw new Error('Browser model has an invalid size.');
  await fs.mkdir(file.slice(0, file.lastIndexOf('/')), { recursive: true });
  await fs.writeFile(file, bytes);
}
async function gzipAsset(source, destination) {
  const original = await fs.readFile(source),
    encoded = await compress(original, { level: 9 });
  if (encoded.length > 25 * 1024 * 1024)
    throw new Error(`Compressed runtime exceeds Pages asset limit: ${destination}`);
  await fs.writeFile(destination, encoded);
}
await fs.mkdir('public/tool-runtime', { recursive: true });
await build({
  entryPoints: ['src/tool-runtime/diagram-renderer.js'],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'chrome120',
  outfile: 'public/tool-runtime/diagram.js',
  minify: true,
  legalComments: 'linked',
});
await gzipAsset('node_modules/pandoc-wasm/src/pandoc.wasm', 'public/tool-runtime/pandoc.wasm.gz');
await fs.rm('public/tool-runtime/pandoc.wasm', { force: true });
await fs.mkdir('public/tool-runtime/ffmpeg', { recursive: true });
await fs.copyFile(
  'node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.js',
  'public/tool-runtime/ffmpeg/ffmpeg-core.js',
);
await gzipAsset(
  'node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.wasm',
  'public/tool-runtime/ffmpeg/ffmpeg-core.wasm.gz',
);
await fs.copyFile(
  'node_modules/pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf',
  'public/tool-runtime/ffmpeg/subtitle-font.ttf',
);
await fs.copyFile(
  'node_modules/pdfjs-dist/standard_fonts/LICENSE_LIBERATION',
  'public/tool-runtime/ffmpeg/FONT-LICENSE.txt',
);
for (const folder of ['cmaps', 'standard_fonts', 'wasm'])
  await fs.cp(`node_modules/pdfjs-dist/${folder}`, `public/tool-runtime/pdfjs/${folder}`, {
    recursive: true,
  });
await fs.mkdir('public/tool-runtime/ocr', { recursive: true });
await ensureModel(
  '.tools/models/document/eng.traineddata.gz',
  'https://tessdata.projectnaptha.com/4.0.0/eng.traineddata.gz',
);
await fs.copyFile(
  'node_modules/tesseract.js/dist/worker.min.js',
  'public/tool-runtime/ocr/worker.min.js',
);
await fs.copyFile(
  '.tools/models/document/eng.traineddata.gz',
  'public/tool-runtime/ocr/eng.traineddata.gz',
);
for (const name of [
  'tesseract-core-lstm.wasm.js',
  'tesseract-core-lstm.wasm',
  'tesseract-core-simd-lstm.wasm.js',
  'tesseract-core-simd-lstm.wasm',
  'tesseract-core-relaxedsimd-lstm.wasm.js',
  'tesseract-core-relaxedsimd-lstm.wasm',
])
  await fs.copyFile('node_modules/tesseract.js-core/' + name, 'public/tool-runtime/ocr/' + name);
await fs.mkdir('public/tool-runtime/ort', { recursive: true });
for (const name of ['ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm'])
  await fs.copyFile('node_modules/onnxruntime-web/dist/' + name, 'public/tool-runtime/ort/' + name);
await fs.mkdir('public/tool-runtime/models', { recursive: true });
await ensureModel(
  '.tools/models/image/u2netp.onnx',
  'https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx',
);
await gzipAsset('.tools/models/image/u2netp.onnx', 'public/tool-runtime/models/u2netp.onnx.gz');
const superResolutionCache = '.tools/browser-models/super-resolution-10.onnx';
let superResolution = await fs.readFile(superResolutionCache).catch(async () => {
  const response = await fetch(
    'https://media.githubusercontent.com/media/onnx/models/main/validated/vision/super_resolution/sub_pixel_cnn_2016/model/super-resolution-10.onnx',
    { signal: AbortSignal.timeout(60000) },
  );
  if (!response.ok) throw new Error('Browser super-resolution model download failed.');
  const bytes = Buffer.from(await response.arrayBuffer());
  await fs.mkdir('.tools/browser-models', { recursive: true });
  await fs.writeFile(superResolutionCache, bytes);
  return bytes;
});
if (
  createHash('sha256').update(superResolution).digest('hex') !==
  '85f36ff88cc504a24af5e0602148bc56a8aa09a58eca8c0da2756f3e8186035e'
)
  throw new Error('Browser super-resolution model integrity mismatch.');
await gzipAsset(superResolutionCache, 'public/tool-runtime/models/super-resolution-10.onnx.gz');
await fs.mkdir('public/tool-runtime/font', { recursive: true });
await fs.copyFile(
  'node_modules/fonteditor-core/woff2/woff2.wasm',
  'public/tool-runtime/font/woff2.wasm',
);
await fs.mkdir('public/tool-runtime/qpdf', { recursive: true });
for (const name of ['qpdf.mjs', 'qpdf.js', 'browser.js', 'qpdf.wasm', 'LICENSE'])
  await fs.copyFile('node_modules/@jspawn/qpdf-wasm/' + name, 'public/tool-runtime/qpdf/' + name);
await fs.cp('node_modules/@lipoe/browser-qpdf/dist', 'public/tool-runtime/qpdf-images', {
  recursive: true,
});
await fs.mkdir('public/tool-runtime/onnx', { recursive: true });
await fs.copyFile(
  'node_modules/@huggingface/transformers/node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.mjs',
  'public/tool-runtime/onnx/ort-wasm-simd-threaded.jsep.mjs',
);
await gzipAsset(
  'node_modules/@huggingface/transformers/node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.wasm',
  'public/tool-runtime/onnx/ort-wasm-simd-threaded.jsep.wasm.gz',
);
for (const codec of ['jpeg', 'webp', 'avif']) {
  await fs.cp(`node_modules/@jsquash/${codec}/codec`, `public/tool-runtime/${codec}/codec`, {
    recursive: true,
  });
}
await prepareSpeechModel();
await fs.mkdir('public/tool-runtime/raw', { recursive: true });
for (const name of ['index.js', 'worker.js', 'libraw.js', 'libraw.wasm'])
  await fs.copyFile('node_modules/libraw-wasm/dist/' + name, 'public/tool-runtime/raw/' + name);
await fs.cp('node_modules/@jsquash/jxl/codec/dec', 'public/tool-runtime/jxl/codec/dec', {
  recursive: true,
});
console.log('Browser diagram, compressed Pandoc/media, PDF, OCR and image engines prepared.');
