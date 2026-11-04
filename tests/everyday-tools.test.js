import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import { unzipSync } from 'fflate';
import { convertTool, validateToolOptions, selectedPages } from '../server/conversion/everyday.js';

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'everyday-tools-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}
async function image(root, name = 'image.png', width = 120, height = 80) {
  const file = path.join(root, name);
  await sharp({ create: { width, height, channels: 4, background: '#b93634' } })
    .png()
    .toFile(file);
  return { path: file, source: 'png', name };
}
async function pdf(root, name, widths) {
  const doc = await PDFDocument.create();
  for (const width of widths) doc.addPage([width, 300]);
  const file = path.join(root, name);
  await fs.writeFile(file, await doc.save());
  return { path: file, source: 'pdf', name };
}
async function load(result) {
  return PDFDocument.load(await fs.readFile(result.path));
}

test('everyday image tools produce requested dimensions, crop bounds and target-size feedback', async (t) => {
  const root = await fixture(t),
    input = await image(root);
  const resized = await convertTool({
    operation: 'resize-image',
    inputs: [input],
    outputDir: root,
    options: { width: 50, height: 50, fit: 'contain' },
  });
  const meta = await sharp(resized.path).metadata();
  assert.equal(meta.width, 50);
  assert.equal(meta.height, 50);
  const cropped = await convertTool({
    operation: 'crop-image',
    inputs: [input],
    outputDir: root,
    options: { left: 10, top: 5, width: 40, height: 20, rotate: 90 },
  });
  const cropMeta = await sharp(cropped.path).metadata();
  assert.equal(cropMeta.width, 20);
  assert.equal(cropMeta.height, 40);
  await assert.rejects(
    convertTool({
      operation: 'crop-image',
      inputs: [input],
      outputDir: root,
      options: { left: 110, width: 20, height: 20 },
    }),
    /crop must stay inside/,
  );
  const compressed = await convertTool({
    operation: 'compress-image',
    inputs: [input],
    outputDir: root,
    options: { targetKB: 10 },
  });
  assert.equal(compressed.details.targetMet, true);
  assert.ok((await fs.stat(compressed.path)).size <= 10240);
});

test('PDF merge keeps document order and split produces selected pages or valid PDF files in a ZIP', async (t) => {
  const root = await fixture(t),
    a = await pdf(root, 'a.pdf', [200, 210]),
    b = await pdf(root, 'b.pdf', [220]);
  const merged = await convertTool({ operation: 'merge-pdf', inputs: [b, a], outputDir: root });
  const document = await load(merged);
  assert.deepEqual(
    document.getPages().map((page) => page.getWidth()),
    [220, 200, 210],
  );
  const input = { path: merged.path, source: 'pdf' };
  const extracted = await convertTool({
    operation: 'split-pdf',
    inputs: [input],
    outputDir: root,
    options: { pages: '3, 1' },
  });
  assert.deepEqual(
    (await load(extracted)).getPages().map((page) => page.getWidth()),
    [210, 220],
  );
  const separate = await convertTool({
    operation: 'split-pdf',
    inputs: [input],
    outputDir: root,
    options: { pages: '2-3', mode: 'separate' },
  });
  const files = unzipSync(await fs.readFile(separate.path));
  assert.deepEqual(Object.keys(files), ['page-002.pdf', 'page-003.pdf']);
  for (const data of Object.values(files))
    assert.equal((await PDFDocument.load(data)).getPageCount(), 1);
  await assert.rejects(
    convertTool({
      operation: 'split-pdf',
      inputs: [input],
      outputDir: root,
      options: { pages: '4' },
    }),
    /between 1 and 3/,
  );
});

test('images-to-PDF combines files into one valid PDF and rejects mismatched or corrupt content', async (t) => {
  const root = await fixture(t),
    a = await image(root, 'a.png', 80, 100),
    b = await image(root, 'b.png', 100, 80);
  const result = await convertTool({ operation: 'images-to-pdf', inputs: [a, b], outputDir: root });
  const document = await load(result);
  assert.equal(document.getPageCount(), 2);
  assert.ok(document.getPage(0).getHeight() > document.getPage(0).getWidth());
  assert.ok(document.getPage(1).getWidth() > document.getPage(1).getHeight());
  await assert.rejects(
    convertTool({ operation: 'resize-image', inputs: [{ ...a, source: 'jpg' }], outputDir: root }),
    /content does not match/,
  );
  const bad = path.join(root, 'bad.pdf');
  await fs.writeFile(bad, 'broken');
  await assert.rejects(
    convertTool({
      operation: 'split-pdf',
      inputs: [{ path: bad, source: 'pdf' }],
      outputDir: root,
    }),
    /contents do not match/,
  );
  assert.throws(
    () => validateToolOptions('resize-image', { width: 8192, height: 8192 }),
    /40 million/,
  );
  assert.throws(
    () => validateToolOptions('compress-image', { allowResize: 'yes' }),
    /Invalid allowResize/,
  );
  assert.throws(() => selectedPages('1,,3', 3), /page numbers/);
});
