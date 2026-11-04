import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { convert } from '../src/browser/advanced-document-engine.js';
import { extractImageArchive } from '../src/browser/advanced-document-core.js';
import { safeUnzip } from '../src/browser/utility-common.js';
const source = async () => {
  const pdf = await PDFDocument.create();
  pdf.addPage([100, 100]);
  pdf.setTitle('Private');
  return new Blob([await pdf.save()]);
};
const args = (operation, file, options = {}) => ({
  operation,
  inputs: [{ file, name: 'a.pdf', source: 'pdf' }],
  options,
});
test('advanced PDF tools reject empty password, invalid PDF and cancellation', async () => {
  await assert.rejects(convert(args('protect-pdf', await source(), { password: '' })), /password/i);
  await assert.rejects(
    convert(args('protect-pdf', new Blob(['not a PDF']), { password: 'known' })),
    /PDF/i,
  );
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    convert({
      ...args('protect-pdf', await source(), { password: 'known' }),
      signal: controller.signal,
    }),
    /cancel/i,
  );
});
test('original JPEG stream extraction preserves exact image bytes', async () => {
  const { createCanvas } = await import('@napi-rs/canvas');
  const c = createCanvas(10, 10),
    ctx = c.getContext('2d');
  ctx.fillStyle = 'red';
  ctx.fillRect(0, 0, 10, 10);
  const jpeg = new Uint8Array(c.toBuffer('image/jpeg'));
  const pdf = await PDFDocument.create(),
    image = await pdf.embedJpg(jpeg),
    page = pdf.addPage([100, 100]);
  page.drawImage(image, { x: 0, y: 0, width: 100, height: 100 });
  const { createQpdfImageStreams } = await import('@lipoe/browser-qpdf');
  const qpdf = await createQpdfImageStreams(),
    loaded = qpdf.loadPdf(new Uint8Array(await pdf.save()));
  assert.ok(loaded.ok);
  let r;
  try {
    const out = await extractImageArchive(loaded.value);
    r = { blob: new Blob([out.bytes]) };
  } finally {
    loaded.value.close();
  }
  const files = safeUnzip(new Uint8Array(await r.blob.arrayBuffer())),
    member = Object.entries(files).find(([name]) => name.endsWith('.jpg'));
  assert.ok(member, 'JPEG member exists');
  assert.deepEqual(member[1], jpeg);
  const index = JSON.parse(new TextDecoder().decode(files['index.json']));
  assert.equal(index.images.length, 1);
  assert.equal(index.images[0].width, 10);
});
test('HTML renderer removes CSS resource loaders while preserving layout declarations', async () => {
  const { cssSafe } = await import('../src/browser/advanced-document-engine.js');
  const css = await cssSafe(
    '@import "https://example.com/x.css"; @font-face{font-family:remote;src:url(https://example.com/a.woff)} .box{width:50px;color:red;background:url(https://example.com/a.png);background-image:image-set("https://example.com/b.png" 1x)}',
  );
  assert.match(css, /width:50px/);
  assert.match(css, /color:red/);
  assert.doesNotMatch(css, /https:|url\(|@import|@font-face|image-set/i);
  const inline = await cssSafe(
    'color: blue; background-image: url(https://example.com/x); --asset: url(https://example.com/y)',
    'declarationList',
  );
  assert.match(inline, /color:blue/);
  assert.doesNotMatch(inline, /https:|url\(/);
});
