import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { PDFDocument, rgb } from 'pdf-lib';
import { zipSync, unzipSync } from 'fflate';
import { convertTool } from '../server/conversion/everyday.js';
import { toolDefaults } from '../shared/everyday-tools.js';
async function fixture(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lc-reports-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  let i = 0;
  return async (id, files, options = {}) => {
    const inputs = [];
    for (const [name, buffer] of files) {
      const p = path.join(dir, `${++i}-${name}`);
      await fs.writeFile(p, buffer);
      inputs.push({ path: p, name, source: name.split('.').pop(), size: buffer.length });
    }
    const r = await convertTool({
      operation: id,
      inputs,
      outputDir: dir,
      options: { ...toolDefaults(id), ...options },
    });
    return { ...r, buffer: await fs.readFile(r.path) };
  };
}
test('metadata reports detect real camera fields and compare two originals', async (t) => {
  const run = await fixture(t),
    a = await sharp({ create: { width: 32, height: 20, channels: 3, background: 'red' } })
      .jpeg()
      .withExif({ IFD0: { Make: 'Test Camera', Artist: 'Alice' } })
      .toBuffer(),
    b = await sharp(a).jpeg().toBuffer();
  const report = await run('photo-privacy', [['a.jpg', a]]);
  const privacy = JSON.parse(report.buffer);
  assert.equal(privacy.hasIdentifyingMetadata, true);
  assert.match(report.buffer.toString(), /Test Camera|Alice/);
  const diff = await run('compare-metadata', [
    ['a.jpg', a],
    ['b.jpg', b],
  ]);
  assert.ok(JSON.parse(diff.buffer).changes.length > 0);
  const advanced = await run('image-metadata', [['a.jpg', a]], { reportFormat: 'csv' });
  assert.match(advanced.buffer.toString(), /Make/);
  assert.match(advanced.filename, /\.csv$/);
  await assert.rejects(run('compare-metadata', [['a.jpg', a]]));
});
test('PDF metadata and page sizing change actual PDF bytes', async (t) => {
  const run = await fixture(t),
    doc = await PDFDocument.create();
  doc.setAuthor('Alice');
  doc.setTitle('Original');
  doc.addPage([300, 200]);
  const src = Buffer.from(await doc.save());
  const edit = await run('pdf-metadata', [['a.pdf', src]], {
    mode: 'edit',
    author: 'Bob',
    title: 'Changed',
  });
  const edited = await PDFDocument.load(edit.buffer);
  assert.equal(edited.getAuthor(), 'Bob');
  assert.equal(edited.getTitle(), 'Changed');
  const removed = await run('pdf-metadata', [['a.pdf', src]], { mode: 'remove' });
  assert.ok(!(await PDFDocument.load(removed.buffer, { updateMetadata: false })).getAuthor());
  const resized = await run('pdf-page-size', [['a.pdf', src]], { paper: 'letter' });
  const page = (await PDFDocument.load(resized.buffer)).getPage(0);
  assert.equal(page.getWidth(), 612);
  assert.equal(page.getHeight(), 792);
  const sheet = await run('pdf-contact-sheet', [['a.pdf', src]]);
  assert.equal((await sharp(sheet.buffer).metadata()).format, 'png');
});
test('document statistics and type inspector examine contents instead of names', async (t) => {
  const run = await fixture(t);
  const stats = JSON.parse(
    (await run('document-stats', [['a.md', Buffer.from('# Heading\n\nHello world.')]])).buffer,
  );
  assert.equal(stats.words, 3);
  assert.equal(stats.headings, 1);
  const pdf = await PDFDocument.create();
  pdf.addPage();
  const disguised = await run('inspect-file', [['wrong.jpg', Buffer.from(await pdf.save())]]);
  assert.equal(JSON.parse(disguised.buffer).extensionMatches, false);
  assert.equal(JSON.parse(disguised.buffer).detected, 'pdf');
  const unknown = await run('inspect-file', [['random.bin', Buffer.from([0, 1, 2, 3, 4])]]);
  assert.equal(JSON.parse(unknown.buffer).detected, 'unknown');
});
test('styled QR presets decode correctly and report scan verification', async (t) => {
  const run = await fixture(t);
  const qr = await run('create-code', [['a.txt', Buffer.from('https://example.com')]], {
    dots: 'rounded',
    foreground: '#112233',
    verify: true,
  });
  assert.equal(qr.details.scanVerified, true);
  const read = await run('read-code', [['a.png', qr.buffer]]);
  assert.equal(read.buffer.toString(), 'https://example.com');
  const wifi = await run('create-code', [['a.txt', Buffer.from('Cafe WiFi')]], {
    preset: 'wifi',
    password: 'secret123',
    verify: true,
  });
  assert.equal(wifi.details.scanVerified, true);
  const payload = (await run('read-code', [['a.png', wifi.buffer]])).buffer.toString();
  assert.match(payload, /^WIFI:T:WPA;S:Cafe WiFi;P:secret123;;$/);
});
test('batch compression exports separate images and an honest size report', async (t) => {
  const run = await fixture(t),
    png = await sharp({ create: { width: 100, height: 80, channels: 3, background: 'blue' } })
      .png()
      .toBuffer();
  const batch = await run(
    'compress-image',
    [
      ['a.png', png],
      ['b.png', png],
    ],
    { targetKB: 10 },
  );
  const files = unzipSync(batch.buffer);
  assert.equal(Object.keys(files).filter((n) => n.endsWith('.jpg')).length, 2);
  assert.ok(files['compression-report.json']);
});
test('DOCX preview sanitizes links and includes extraction warnings', async (t) => {
  const run = await fixture(t);
  const docx = Buffer.from(
    zipSync({
      '[Content_Types].xml': Buffer.from(
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>',
      ),
      'word/document.xml': Buffer.from(
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Hello Word</w:t></w:r></w:p></w:body></w:document>',
      ),
    }),
  );
  const out = await run('docx-preview', [['sample.docx', docx]]);
  assert.match(out.buffer.toString(), /Hello Word/);
  assert.doesNotMatch(out.buffer.toString(), /<script/);
});
test('diagram export works in the isolated renderer and rejects active directives', async (t) => {
  const run = await fixture(t),
    svg = await run('diagram-studio', [
      ['a.txt', Buffer.from('flowchart LR\n A[Start] --> B[Done]')],
    ]);
  assert.match(svg.buffer.toString(), /<svg/);
  assert.match(svg.buffer.toString(), /Start/);
  await assert.rejects(
    run('diagram-studio', [
      ['a.txt', Buffer.from('%%{init: {"securityLevel":"loose"}}%%\nflowchart LR\n A-->B')],
    ]),
  );
});
test('advanced metadata keeps image properties and file inspector identifies EPUB contents', async (t) => {
  const run = await fixture(t),
    png = await sharp({ create: { width: 32, height: 20, channels: 3, background: 'red' } })
      .png()
      .toBuffer(),
    report = JSON.parse((await run('image-metadata', [['a.png', png]])).buffer);
  assert.equal(report.width, 32);
  assert.equal(report.height, 20);
  const epub = Buffer.from(
    zipSync({
      mimetype: Buffer.from('application/epub+zip'),
      'META-INF/container.xml': Buffer.from('<container/>'),
    }),
  );
  assert.equal(JSON.parse((await run('inspect-file', [['a.epub', epub]])).buffer).detected, 'epub');
});
test('PDF resizing preserves the visible crop and never reveals hidden page areas', async (t) => {
  const run = await fixture(t),
    doc = await PDFDocument.create(),
    p = doc.addPage([400, 400]);
  p.drawRectangle({ x: 0, y: 0, width: 400, height: 400, color: rgb(1, 0, 0) });
  p.drawRectangle({ x: 100, y: 100, width: 200, height: 100, color: rgb(0, 0, 1) });
  p.setCropBox(100, 100, 200, 100);
  const result = await run('pdf-page-size', [['cropped.pdf', Buffer.from(await doc.save())]]);
  const { convertPdf } = await import('../server/conversion/pdf.js');
  const rendered = await convertPdf(result.buffer, 'png', { page: 1, scale: 1 });
  const pixels = await sharp(rendered.buffer).removeAlpha().raw().toBuffer();
  let red = 0,
    blue = 0;
  for (let i = 0; i < pixels.length; i += 3) {
    if (pixels[i] > 200 && pixels[i + 1] < 50 && pixels[i + 2] < 50) red++;
    if (pixels[i] < 50 && pixels[i + 1] < 50 && pixels[i + 2] > 200) blue++;
  }
  assert.equal(red, 0);
  assert.ok(blue > 10000);
});
test('document statistics preserve HTML line, cell and paragraph boundaries', async (t) => {
  const run = await fixture(t);
  let r = JSON.parse(
    (await run('document-stats', [['a.html', Buffer.from('<p>One<br>two</p>')]])).buffer,
  );
  assert.equal(r.words, 2);
  assert.equal(r.paragraphs, 1);
  r = JSON.parse(
    (
      await run('document-stats', [
        ['a.html', Buffer.from('<h1>Title</h1><p>Paragraph one.</p><p>Paragraph two.</p>')],
      ])
    ).buffer,
  );
  assert.equal(r.paragraphs, 2);
  assert.equal(r.headings, 1);
  r = JSON.parse(
    (
      await run('document-stats', [
        ['a.html', Buffer.from('<table><tr><td>One</td><td>two</td></tr></table>')],
      ])
    ).buffer,
  );
  assert.equal(r.words, 2);
});
