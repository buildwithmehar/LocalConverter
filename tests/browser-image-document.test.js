import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas, loadImage, ImageData } from '@napi-rs/canvas';
import { PDFDocument, degrees } from 'pdf-lib';
import { unzipSync } from 'fflate';
import {
  convert,
  convertPair,
  isSupportedPair,
  validateOptions,
  unsupportedReasons,
} from '../src/browser/image-document-engine.js';
import { parsePages } from '../src/browser/image-common.js';
import {
  encodeBmp,
  encodeIco,
  writeDpi,
  safeSvg,
  vectorizePixels,
} from '../src/browser/image-engine.js';
import { validateDocumentArchive, safeDocumentInput } from '../src/browser/document-engine.js';
import {
  segmentationInput,
  normalizedMask,
  validateFont,
  convertFont,
} from '../src/browser/advanced-image-engine.js';
import fs from 'node:fs/promises';
import { inspectJxl } from '../src/browser/image-extra-codecs.js';
import { lumaPlane } from '../src/browser/image-upscale-engine.js';
import { officeSections } from '../src/browser/document-office-engine.js';
import { JSDOM } from 'jsdom';
import { lineTable } from '../src/browser/pdf-table-engine.js';

// The browser engine itself never imports Node or the native canvas package.
// These Canvas-compatible adapters let byte/pixel tests exercise the same engine.
globalThis.ImageData = ImageData;
globalThis.DOMParser = new JSDOM('').window.DOMParser;
globalThis.OffscreenCanvas = class {
  constructor(width, height) {
    const c = createCanvas(width, height);
    c.convertToBlob = async ({ type = 'image/png', quality = 0.9 } = {}) =>
      new Blob([c.toBuffer(type, type === 'image/jpeg' ? Math.round(quality * 100) : undefined)], {
        type,
      });
    return c;
  }
};
globalThis.createImageBitmap = async (file) => {
  const image = await loadImage(Buffer.from(await file.arrayBuffer()));
  image.close = () => {};
  return image;
};
function png(width = 8, height = 6) {
  const c = createCanvas(width, height),
    ctx = c.getContext('2d');
  ctx.fillStyle = 'red';
  ctx.fillRect(0, 0, width / 2, height);
  ctx.fillStyle = 'blue';
  ctx.fillRect(width / 2, 0, width / 2, height);
  return new File([c.toBuffer('image/png')], 'photo.png', {
    type: 'image/png',
  });
}
const input = (file) => ({
  file,
  name: file.name,
  source: file.name.split('.').pop(),
});
async function pdfFile(sizes = [[200, 300]], name = 'input.pdf') {
  const pdf = await PDFDocument.create();
  for (const size of sizes) pdf.addPage(size);
  return new File([await pdf.save()], name, { type: 'application/pdf' });
}
async function pdfOutput(out) {
  assert.equal(out.mime, 'application/pdf');
  return PDFDocument.load(await out.blob.arrayBuffer());
}
async function imageOutput(out) {
  return loadImage(Buffer.from(await out.blob.arrayBuffer()));
}

test('page selection validates bounds, range order and reorder duplicates', () => {
  assert.deepEqual(parsePages('3,1-2', 3), [2, 0, 1]);
  assert.deepEqual(parsePages('', 2), [0, 1]);
  assert.throws(() => parsePages('0', 3), /between/);
  assert.throws(() => parsePages('3-2', 3), /between/);
  assert.throws(() => parsePages('1,1', 2, { unique: false }), /once/);
  assert.throws(() => parsePages('1-nope', 2), /ranges/);
});
test('PDF vector grid detection assigns selectable text to real cells', () => {
  const OPS = { save: 1, restore: 2, transform: 3, constructPath: 4 },
    fnArray = [],
    argsArray = [];
  for (const x of [10, 110, 210]) {
    fnArray.push(4);
    argsArray.push([20, [new Float32Array([0, x, 0, 1, x, 200])], [x, 0, x, 200]]);
  }
  for (const y of [0, 100, 200]) {
    fnArray.push(4);
    argsArray.push([20, [new Float32Array([0, 10, y, 1, 210, y])], [10, y, 210, y]]);
  }
  const items = [
    { str: 'A', transform: [1, 0, 0, 1, 20, 150], width: 10, height: 10 },
    { str: 'B', transform: [1, 0, 0, 1, 120, 150], width: 10, height: 10 },
    { str: 'C', transform: [1, 0, 0, 1, 20, 50], width: 10, height: 10 },
    { str: 'D', transform: [1, 0, 0, 1, 120, 50], width: 10, height: 10 },
  ];
  assert.deepEqual(lineTable({ fnArray, argsArray }, items, OPS), [
    ['A', 'B'],
    ['C', 'D'],
  ]);
  assert.deepEqual(lineTable({ fnArray: [], argsArray: [] }, items, OPS), []);
});
test('PDF merge, selected extraction and separate ZIP preserve actual page dimensions', async () => {
  const a = await pdfFile(
      [
        [100, 200],
        [200, 300],
      ],
      'a.pdf',
    ),
    b = await pdfFile([[300, 400]], 'b.pdf');
  const merged = await pdfOutput(
    await convert({ operation: 'merge-pdf', inputs: [input(a), input(b)] }),
  );
  assert.equal(merged.getPageCount(), 3);
  assert.deepEqual(
    merged.getPages().map((p) => p.getSize().width),
    [100, 200, 300],
  );
  const extracted = await pdfOutput(
    await convert({
      operation: 'split-pdf',
      inputs: [input(a)],
      options: { pages: '2,1' },
    }),
  );
  assert.deepEqual(
    extracted.getPages().map((p) => p.getWidth()),
    [200, 100],
  );
  const separate = await convert({
    operation: 'split-pdf',
    inputs: [input(a)],
    options: { mode: 'separate', pages: '2' },
  });
  assert.equal(separate.mime, 'application/zip');
  const files = unzipSync(new Uint8Array(await separate.blob.arrayBuffer()));
  assert.deepEqual(Object.keys(files), ['page-002.pdf']);
  const page = await PDFDocument.load(files['page-002.pdf']);
  assert.equal(page.getPage(0).getWidth(), 200);
});
test('PDF rotation is added to existing rotation; reorder omits unselected pages', async () => {
  const p = await PDFDocument.create();
  p.addPage([100, 200]).setRotation(degrees(90));
  p.addPage([300, 400]);
  const file = new File([await p.save()], 'rotated.pdf');
  const out = await pdfOutput(
    await convert({
      operation: 'rotate-pdf',
      inputs: [input(file)],
      options: { pages: '1', angle: '180' },
    }),
  );
  assert.equal(out.getPage(0).getRotation().angle, 270);
  assert.equal(out.getPage(1).getRotation().angle, 0);
  const reordered = await pdfOutput(
    await convert({
      operation: 'reorder-pdf',
      inputs: [input(file)],
      options: { pages: '2' },
    }),
  );
  assert.equal(reordered.getPageCount(), 1);
  assert.equal(reordered.getPage(0).getWidth(), 300);
  await assert.rejects(
    convert({
      operation: 'reorder-pdf',
      inputs: [input(file)],
      options: { pages: '1,1' },
    }),
    /once/,
  );
});
test('PDF form filling validates names, types and selections, then flattens', async () => {
  const p = await PDFDocument.create(),
    page = p.addPage([300, 300]),
    form = p.getForm();
  form.createTextField('name').addToPage(page, { x: 10, y: 200, width: 200, height: 30 });
  form.createCheckBox('agreed').addToPage(page, { x: 10, y: 150, width: 20, height: 20 });
  const file = new File([await p.save()], 'form.pdf');
  const out = await pdfOutput(
    await convert({
      operation: 'fill-pdf-form',
      inputs: [input(file)],
      options: { values: '{"name":"Ada","agreed":true}', flatten: false },
    }),
  );
  assert.equal(out.getForm().getTextField('name').getText(), 'Ada');
  assert.equal(out.getForm().getCheckBox('agreed').isChecked(), true);
  const flat = await pdfOutput(
    await convert({
      operation: 'fill-pdf-form',
      inputs: [input(file)],
      options: { values: '{"name":"Ada"}', flatten: true },
    }),
  );
  assert.equal(flat.getForm().getFields().length, 0);
  await assert.rejects(
    convert({
      operation: 'fill-pdf-form',
      inputs: [input(file)],
      options: { values: '{"missing":"x"}' },
    }),
    /Unknown field.*Available/,
  );
  await assert.rejects(
    convert({
      operation: 'fill-pdf-form',
      inputs: [input(file)],
      options: { values: '{"agreed":"yes"}' },
    }),
    /true or false/,
  );
});
test('image resize, inside fit, crop rotation and collage produce requested pixels', async () => {
  const file = png();
  const resize = await imageOutput(
    await convert({
      operation: 'resize-image',
      inputs: [input(file)],
      options: { width: 16, height: 10, fit: 'fill' },
    }),
  );
  assert.deepEqual([resize.width, resize.height], [16, 10]);
  const inside = await imageOutput(
    await convert({
      operation: 'resize-image',
      inputs: [input(file)],
      options: { width: 20, height: 20, fit: 'inside' },
    }),
  );
  assert.deepEqual([inside.width, inside.height], [20, 15]);
  const crop = await imageOutput(
    await convert({
      operation: 'crop-image',
      inputs: [input(file)],
      options: { left: 0, top: 0, width: 4, height: 6, rotate: 90 },
    }),
  );
  assert.deepEqual([crop.width, crop.height], [6, 4]);
  const c = createCanvas(crop.width, crop.height),
    ctx = c.getContext('2d');
  ctx.drawImage(crop, 0, 0);
  assert.deepEqual([...ctx.getImageData(2, 2, 1, 1).data], [255, 0, 0, 255]);
  const collage = await imageOutput(
    await convert({
      operation: 'image-collage',
      inputs: [input(file), input(file)],
      options: { columns: 2, cellWidth: 20, cellHeight: 10, gap: 3 },
    }),
  );
  assert.deepEqual([collage.width, collage.height], [49, 16]);
  await assert.rejects(
    convert({
      operation: 'crop-image',
      inputs: [input(file)],
      options: { left: 7, width: 2, height: 2 },
    }),
    /outside/,
  );
});
test('compression reports actual target success and batch ZIP contains valid images/report', async () => {
  const file = png(20, 20);
  const out = await convert({
    operation: 'compress-image',
    inputs: [input(file)],
    options: { output: 'png', targetKB: 1 },
  });
  assert.equal(out.details.targetMet, out.blob.size <= 1024);
  assert.ok((await imageOutput(out)).width > 0);
  const batch = await convert({
    operation: 'compress-image',
    inputs: [input(file), input(file)],
    options: { output: 'png' },
  });
  const entries = unzipSync(new Uint8Array(await batch.blob.arrayBuffer()));
  assert.equal(Object.keys(entries).length, 3);
  const report = JSON.parse(new TextDecoder().decode(entries['compression-report.json']));
  assert.equal(report.length, 2);
  assert.equal(report[0].outputBytes, entries['1-compressed.png'].length);
});
test('image pairs encode true TIFF, GIF and BMP and can decode TIFF back to PNG', async () => {
  const file = png(12, 8);
  for (const [target, signature] of [
    ['tiff', [77, 77, 0, 42]],
    ['gif', [71, 73, 70, 56]],
    ['bmp', [66, 77]],
  ]) {
    const out = await convertPair({ source: 'png', target, file });
    const bytes = new Uint8Array(await out.blob.arrayBuffer());
    assert.deepEqual([...bytes.subarray(0, signature.length)], signature);
    if (target === 'tiff') {
      const decoded = await imageOutput(
        await convertPair({ source: 'tiff', target: 'png', file: out.blob }),
      );
      assert.deepEqual([decoded.width, decoded.height], [12, 8]);
    }
  }
});
test('BMP stores BGR rows with aligned strides and composites transparency on white', () => {
  const bytes = encodeBmp({
    width: 1,
    height: 1,
    data: new Uint8Array([255, 0, 0, 128]),
  });
  assert.equal(bytes.length, 58);
  assert.deepEqual([...bytes.subarray(54, 57)], [127, 127, 255]);
  assert.equal(new DataView(bytes.buffer).getUint16(28, true), 24);
});
test('ICO directory contains valid offsets, sizes and the actual PNG payloads', async () => {
  const out = await convert({
      operation: 'icon-favicon',
      inputs: [input(png())],
      options: { mode: 'ico' },
    }),
    bytes = new Uint8Array(await out.blob.arrayBuffer()),
    v = new DataView(bytes.buffer);
  assert.equal(v.getUint16(2, true), 1);
  assert.equal(v.getUint16(4, true), 5);
  assert.equal(bytes[6 + 16 * 4], 0);
  for (let i = 0; i < 5; i++) {
    const length = v.getUint32(6 + 16 * i + 8, true),
      offset = v.getUint32(6 + 16 * i + 12, true);
    assert.deepEqual([...bytes.subarray(offset, offset + 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.ok(offset + length <= bytes.length);
  }
  assert.equal(encodeIco([{ size: 16, bytes: new Uint8Array([1, 2, 3]) }]).length, 25);
});
test('PNG and JPEG DPI metadata carry requested print resolution', async () => {
  const out = await convert({
      operation: 'resize-print-image',
      inputs: [input(png())],
      options: { width: 25.4, height: 25.4, unit: 'mm', dpi: 300 },
    }),
    image = await imageOutput(out);
  assert.deepEqual([image.width, image.height], [300, 300]);
  const bytes = new Uint8Array(await out.blob.arrayBuffer()),
    type = new TextDecoder().decode(bytes.subarray(37, 41));
  assert.equal(type, 'pHYs');
  assert.equal(new DataView(bytes.buffer).getUint32(41), 11811);
  const { default: ExifReader } = await import('exifreader'),
    tags = ExifReader.load(await out.blob.arrayBuffer());
  assert.ok(tags['Pixels Per Unit X'] || tags.XResolution);
  const jpg = await convertPair({ source: 'png', target: 'jpg', file: png() });
  const updated = writeDpi(await jpg.blob.arrayBuffer(), 'jpg', 240);
  const jfif = new TextDecoder().decode(updated.subarray(6, 11));
  assert.equal(jfif, 'JFIF\0');
  assert.equal(new DataView(updated.buffer).getUint16(14), 240);
});
test('SVG optimizer/sprite keep self-contained IDs and vectorizer emits paths without raster embedding', async () => {
  assert.throws(
    () => safeSvg('<svg><image href=http://example.org/a.png /></svg>'),
    /self-contained/,
  );
  assert.throws(() => safeSvg('<svg><script>alert(1)</script></svg>'), /self-contained/);
  assert.doesNotThrow(() => safeSvg('<svg><path fill="url(#a)" /></svg>'));
  assert.doesNotThrow(() => safeSvg('<svg><path style="fill:red;stroke:#000;opacity:.5" /></svg>'));
  for (const svg of [
    '<svg><path style="fill:u\\72l(https://external.example/x)" /></svg>',
    '<svg><path style="fill:u&#92;72l(https://external.example/x)" /></svg>',
    '<svg xml:base="https://external.example/"><use href="#x" /></svg>',
    '<svg><image href="#x"><set attributeName="href" to="https://external.example/x" /></image></svg>',
    '<svg><animate attributeName="href" values="https://external.example/x" /></svg>',
    '<svg><animateTransform attributeName="transform" /></svg>',
    '<svg><animateMotion path="M0 0L1 1" /></svg>',
    '<html><svg /></html>',
    '<svg><path></svg>',
  ])
    assert.throws(() => safeSvg(svg), /self-contained/);
  const file = new File(
    [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><defs><linearGradient id="a"><stop stop-color="red" /></linearGradient></defs><path id="shape" fill="url(#a)" d="M0 0h10v10H0z"/></svg>',
    ],
    'icon.svg',
  );
  const sprite = await convert({
      operation: 'svg-sprite',
      inputs: [input(file), input(file)],
      options: { prefix: 'icon' },
    }),
    text = await sprite.blob.text();
  assert.match(text, /symbol id="icon-1"/);
  assert.match(text, /symbol id="icon-2"/);
  assert.match(text, /icon-1-a/);
  assert.match(text, /icon-2-a/);
  const svg = vectorizePixels(
    {
      width: 2,
      height: 1,
      data: new Uint8Array([255, 0, 0, 255, 0, 0, 255, 255]),
    },
    { detail: 8, colorMode: 'color', speckle: 0 },
  );
  assert.match(svg, /<path fill="#ff0000"/);
  assert.match(svg, /<path fill="#0000ff"/);
  assert.doesNotMatch(svg, /<image|data:/);
});
test('image to PDF uses actual pixels and margins; plain TXT to PDF is valid', async () => {
  const out = await pdfOutput(
    await convert({
      operation: 'images-to-pdf',
      inputs: [input(png(32, 20))],
      options: { paper: 'original', margin: 0 },
    }),
  );
  assert.deepEqual(out.getPage(0).getSize(), { width: 32, height: 20 });
  const text = await pdfOutput(
    await convertPair({
      source: 'txt',
      target: 'pdf',
      file: new File(['Hello browser\nSecond line'], 'hello.txt'),
    }),
  );
  assert.equal(text.getPageCount(), 1);
  await assert.rejects(
    convertPair({ source: 'txt', target: 'pdf', file: new Blob(['😀']) }),
    /Latin-1/,
  );
});
test('explicit unsupported operations, invalid settings and cancellation fail before producing output', async () => {
  await assert.rejects(convert({ operation: 'missing-tool', inputs: [] }), /Unsupported browser/);
  assert.equal(isSupportedPair('png', 'avif'), true);
  assert.equal(isSupportedPair('pdf', 'jpg'), true);
  assert.equal(isSupportedPair('exe', 'pdf'), false);
  assert.throws(() => validateOptions('resize-image', { width: 0 }), /width/);
  assert.throws(() => validateOptions('image-watermark', { opacity: 0 }), /Opacity/);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    convert({
      operation: 'resize-image',
      inputs: [input(png())],
      signal: controller.signal,
    }),
    { name: 'AbortError' },
  );
  assert.throws(() => validateDocumentArchive(new Uint8Array([1, 2, 3])), /valid ZIP/);
});
test('segmentation tensors use normalized RGB planes and masks retain soft alpha', () => {
  const rgba = new Uint8ClampedArray(320 * 320 * 4);
  for (let p = 0; p < rgba.length; p += 4) rgba.set([255, 128, 0, 255], p);
  const tensor = segmentationInput(rgba);
  assert.equal(tensor.length, 3 * 320 * 320);
  assert.ok(Math.abs(tensor[0] - (1 - 0.485) / 0.229) < 1e-5);
  assert.ok(Math.abs(tensor[320 * 320] - (128 / 255 - 0.456) / 0.224) < 1e-5);
  const mask = normalizedMask(new Float32Array([0, 0.5, 1]));
  assert.deepEqual([...mask], [255, 255, 255, 0, 255, 255, 255, 128, 255, 255, 255, 255]);
  assert.throws(() => normalizedMask(new Float32Array([1, 1])), /identify a subject/);
});
test('font container conversion preserves TrueType sfnt outlines and table data', async () => {
  const bytes = new Uint8Array(
    await fs.readFile(
      new URL(
        '../node_modules/pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf',
        import.meta.url,
      ),
    ),
  );
  assert.equal(validateFont(bytes), 'ttf');
  const woff = await convertFont(new Blob([bytes]), 'woff');
  assert.equal(woff.mime, 'font/woff');
  const woffBytes = new Uint8Array(await woff.blob.arrayBuffer());
  assert.equal(validateFont(woffBytes), 'woff');
  const back = await convertFont(woff.blob, 'sfnt');
  assert.equal(back.mime, 'font/ttf');
  const restored = new Uint8Array(await back.blob.arrayBuffer());
  assert.equal(validateFont(restored), 'ttf');
  const table = (data, name) => {
    const v = new DataView(data.buffer, data.byteOffset, data.byteLength);
    for (let i = 0; i < v.getUint16(4); i++) {
      const p = 12 + i * 16;
      if (new TextDecoder().decode(data.subarray(p, p + 4)) === name)
        return data.subarray(v.getUint32(p + 8), v.getUint32(p + 8) + v.getUint32(p + 12));
    }
    throw new Error('Missing table ' + name);
  };
  for (const name of ['glyf', 'loca', 'name', 'cmap'])
    assert.deepEqual(restored && table(restored, name), table(bytes, name));
  assert.throws(() => validateFont(new Uint8Array(12)), /single TTF/);
});
test('PSD preview and layer extraction export cached raster pixels and positions', async () => {
  const module = await import('ag-psd'),
    ag = module.default?.readPsd ? module.default : module;
  ag.initializeCanvas(createCanvas, (w, h) => new ImageData(w, h));
  const rgba = new Uint8ClampedArray(8 * 6 * 4);
  for (let p = 0; p < rgba.length; p += 4) rgba.set([255, 0, 0, 255], p);
  const bitmap = new ImageData(rgba, 8, 6),
    bytes = ag.writePsd(
      {
        width: 8,
        height: 6,
        imageData: bitmap,
        children: [
          {
            name: 'Red layer',
            left: 0,
            top: 0,
            right: 8,
            bottom: 6,
            imageData: bitmap,
          },
        ],
      },
      { generateThumbnail: false },
    );
  const file = new File([bytes], 'fixture.psd'),
    preview = await imageOutput(await convert({ operation: 'psd-export', inputs: [input(file)] }));
  assert.deepEqual([preview.width, preview.height], [8, 6]);
  const layers = await convert({
      operation: 'psd-export',
      inputs: [input(file)],
      options: { mode: 'layers' },
    }),
    entries = unzipSync(new Uint8Array(await layers.blob.arrayBuffer()));
  assert.ok(entries['001-Red_layer.png']);
  const index = JSON.parse(new TextDecoder().decode(entries['layers.json']));
  assert.equal(index.layers[0].left, 0);
  assert.equal(index.layers[0].width, 8);
  const psb = new Uint8Array(bytes.slice(0));
  new DataView(psb.buffer).setUint16(4, 2);
  await assert.rejects(
    convert({
      operation: 'psd-export',
      inputs: [input(new File([psb], 'large.psb'))],
    }),
    /PSB/,
  );
});
test('JPEG XL preflight reads dimensions before decoding and rejects animation', () => {
  const stream = (animated) => {
    const bits = [];
    const put = (value, count) => {
      for (let i = 0; i < count; i++) bits.push((value >> i) & 1);
    };
    put(1, 1);
    put(7, 5);
    put(0, 3);
    put(11, 5);
    put(animated ? 0 : 1, 1);
    if (animated) {
      put(1, 1);
      put(0, 3);
      put(0, 1);
      put(0, 1);
      put(1, 1);
    }
    const out = new Uint8Array(2 + Math.ceil(bits.length / 8));
    out.set([255, 10]);
    bits.forEach((b, i) => (out[2 + (i >> 3)] |= b << (i & 7)));
    return out;
  };
  assert.deepEqual(inspectJxl(stream(false)), {
    width: 96,
    height: 64,
    animated: false,
  });
  assert.throws(() => inspectJxl(stream(true)), /Animated JPEG XL/);
  assert.throws(() => inspectJxl(new Uint8Array([1, 2, 3])), /not a JPEG XL/);
});
test('neural upscale preprocessing uses actual luma and preserves uniform images', () => {
  const rgba = new Uint8ClampedArray([255, 0, 0, 255, 255, 255, 255, 255]);
  const plane = lumaPlane(rgba, 2, 1, 0, false);
  assert.ok(Math.abs(plane[0] - 0.299) < 1e-6);
  assert.equal(plane[1], 1);
  const uniform = new Uint8ClampedArray(4 * 4 * 4).fill(255);
  assert.ok([...lumaPlane(uniform, 4, 4, 3, true)].every((v) => v === 1));
});
test('default scan cleanup detects page borders and produces actual binary pixels', async () => {
  const c = createCanvas(260, 300),
    ctx = c.getContext('2d');
  ctx.fillStyle = '#303030';
  ctx.fillRect(0, 0, 260, 300);
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.moveTo(30, 20);
  ctx.lineTo(230, 40);
  ctx.lineTo(220, 280);
  ctx.lineTo(20, 270);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'black';
  ctx.font = '16px Arial';
  ctx.fillText('LOCAL SCAN', 45, 90);
  const file = new File([c.toBuffer('image/png')], 'scan.png', {
      type: 'image/png',
    }),
    out = await convert({ operation: 'scan-cleanup', inputs: [input(file)] });
  assert.equal(out.details.perspectiveCorrected, true);
  assert.ok(out.details.width < 260);
  const img = await imageOutput(out),
    check = createCanvas(img.width, img.height),
    cc = check.getContext('2d');
  cc.drawImage(img, 0, 0);
  const data = cc.getImageData(0, 0, img.width, img.height).data;
  assert.ok([...data].every((n) => n === 0 || n === 255));
  assert.ok([...data].some((n) => n === 0));
});
test('Office XML extraction preserves slide paragraphs and spreadsheet values', async () => {
  const { JSDOM } = await import('jsdom');
  globalThis.DOMParser = new JSDOM('').window.DOMParser;
  const { zipSync } = await import('fflate'),
    encoder = new TextEncoder();
  const pptx = new Blob([
    zipSync({
      'ppt/slides/slide2.xml': encoder.encode(
        '<p:sld xmlns:p="urn:p" xmlns:a="urn:a"><a:p><a:r><a:t>Second slide</a:t></a:r></a:p></p:sld>',
      ),
      'ppt/slides/slide1.xml': encoder.encode(
        '<p:sld xmlns:p="urn:p" xmlns:a="urn:a"><a:p><a:r><a:t>First slide</a:t></a:r></a:p></p:sld>',
      ),
    }),
  ]);
  const slides = await officeSections(pptx, 'pptx');
  assert.deepEqual(
    slides.map((s) => s.text),
    ['First slide', 'Second slide'],
  );
  const ods = new Blob([
    zipSync({
      'content.xml': encoder.encode(
        '<office:document-content xmlns:office="urn:office" xmlns:table="urn:table" xmlns:text="urn:text"><table:table table:name="Sales"><table:table-row><table:table-cell><text:p>Camera</text:p></table:table-cell><table:table-cell office:value="12" /></table:table-row></table:table></office:document-content>',
      ),
    }),
  ]);
  const sheets = await officeSections(ods, 'ods');
  assert.equal(sheets[0].title, 'Sales');
  assert.equal(sheets[0].text, 'Camera | 12');
});
test('document, spreadsheet and presentation inputs reject CRC-corrupt ZIP payloads', async () => {
  const { zipSync } = await import('fflate'),
    encoder = new TextEncoder();
  for (const [source, name] of [
    ['docx', 'word/document.xml'],
    ['odt', 'content.xml'],
    ['epub', 'content.xhtml'],
    ['xlsx', 'xl/workbook.xml'],
    ['pptx', 'ppt/slides/slide1.xml'],
  ]) {
    const bytes = zipSync(
        { [name]: encoder.encode('<document>Original content</document>') },
        { level: 0 },
      ),
      corrupt = bytes.slice(),
      v = new DataView(corrupt.buffer),
      payload = 30 + v.getUint16(26, true) + v.getUint16(28, true);
    corrupt[payload + 12] ^= 1;
    assert.throws(() => validateDocumentArchive(corrupt), /checksum|Corrupt/);
    if (['docx', 'odt', 'epub'].includes(source))
      await assert.rejects(safeDocumentInput(new Blob([corrupt]), source), /checksum|Corrupt/);
    else await assert.rejects(officeSections(new Blob([corrupt]), source), /checksum|Corrupt/);
  }
});
