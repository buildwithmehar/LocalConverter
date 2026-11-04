import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import sharp from 'sharp';
import ExcelJS from 'exceljs';
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import { convertDocumentTool } from '../server/conversion/document-toolbox.js';
import { documentTools } from '../shared/document-tools.js';
import { runProcess } from '../server/conversion/common.js';
const root = fileURLToPath(new URL('../', import.meta.url));
const python = path.join(root, '.tools/python/Scripts/python.exe');
async function job(fn) {
  const base = path.join(root, '.artifacts', 'runtime-tests', 'documents');
  await fs.mkdir(base, { recursive: true });
  const dir = await fs.mkdtemp(path.join(base, 'documents-'));
  try {
    return await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
async function input(dir, name, data) {
  const p = path.join(dir, name);
  await fs.writeFile(p, data);
  return { path: p, name, source: path.extname(name).slice(1), size: data.length };
}
async function pdfBytes(texts = ['First page', 'Second page']) {
  const d = await PDFDocument.create();
  for (const s of texts) {
    const p = d.addPage([400, 300]);
    p.drawText(s, { x: 30, y: 230, size: 20 });
  }
  return d.save();
}
const convert = (dir, operation, inputs, options = {}) =>
  convertDocumentTool({ operation, inputs, outputDir: dir, options });
async function pdfText(file) {
  return runProcess(python, [
    '-c',
    'import pymupdf,sys; sys.stdout.reconfigure(encoding="utf-8"); d=pymupdf.open(sys.argv[1]); print("\\n".join(p.get_text() for p in d))',
    file,
  ]);
}

test('document metadata declares usable defaults and unique IDs', () => {
  assert.equal(new Set(documentTools.map((t) => t.id)).size, documentTools.length);
  for (const t of documentTools) {
    assert.equal(t.engine, 'document');
    for (const f of t.fields) assert.ok(Object.hasOwn(t.defaults, f.key));
  }
});
test('PDF reorder, rotation, stamps, lossless and lossy compression produce readable PDFs', () =>
  job(async (dir) => {
    const src = await input(dir, 'source.pdf', await pdfBytes());
    const reordered = await convert(dir, 'reorder-pdf', [src], { pages: '2,1' });
    assert.ok(
      (await pdfText(reordered.path)).indexOf('Second') <
        (await pdfText(reordered.path)).indexOf('First'),
    );
    const rotated = await convert(dir, 'rotate-pdf', [src], { angle: '90', pages: '2' });
    const loaded = await PDFDocument.load(await fs.readFile(rotated.path));
    assert.equal(loaded.getPage(0).getRotation().angle, 0);
    assert.equal(loaded.getPage(1).getRotation().angle, 90);
    const stamped = await convert(dir, 'stamp-pdf', [src], { text: 'APPROVED', opacity: 100 });
    assert.match(await pdfText(stamped.path), /APPROVED/);
    const overlay = await input(dir, 'overlay.pdf', await pdfBytes(['Overlay fixture']));
    const overlaid = await convert(dir, 'stamp-pdf', [src, overlay], {
      kind: 'overlay',
      pages: '1',
    });
    assert.match(await pdfText(overlaid.path), /Overlay fixture/);
    const lossless = await convert(dir, 'compress-pdf', [src]);
    assert.equal((await PDFDocument.load(await fs.readFile(lossless.path))).getPageCount(), 2);
    const lossy = await convert(dir, 'compress-pdf', [src], { mode: 'raster' });
    assert.equal(lossy.details.lossy, true);
    assert.equal((await pdfText(lossy.path)).trim(), '');
    await assert.rejects(convert(dir, 'reorder-pdf', [src], { pages: '1,1' }), /repeat pages/);
  }));
test('AES protected PDF requires known password and unlock restores readable content', () =>
  job(async (dir) => {
    const src = await input(dir, 'source.pdf', await pdfBytes(['Secret content']));
    const encrypted = await convert(dir, 'protect-pdf', [src], { password: 'fixture-password' });
    const protectedInput = { ...src, path: encrypted.path };
    await assert.rejects(
      convert(dir, 'unlock-pdf', [protectedInput], { password: 'wrong-password' }),
      /incorrect/,
    );
    // Use a distinct input name because result.pdf is the common output filename.
    const copy = await input(dir, 'protected.pdf', await fs.readFile(encrypted.path));
    const unlocked = await convert(dir, 'unlock-pdf', [copy], { password: 'fixture-password' });
    assert.match(await pdfText(unlocked.path), /Secret content/);
    assert.ok(!(await fs.readdir(dir)).some((n) => /^document-.*\.json$/.test(n)));
  }));
test('AcroForm filling and flattening preserve entered text', () =>
  job(async (dir) => {
    const d = await PDFDocument.create(),
      p = d.addPage([400, 300]);
    const field = d.getForm().createTextField('person');
    field.addToPage(p, { x: 20, y: 180, width: 200, height: 30 });
    const checkbox = d.getForm().createCheckBox('approved');
    checkbox.addToPage(p, { x: 20, y: 120, width: 20, height: 20 });
    const src = await input(dir, 'form.pdf', await d.save());
    const out = await convert(dir, 'fill-pdf-form', [src], {
      values: '{"person":"Ada Lovelace"}',
      flatten: true,
    });
    const check = await PDFDocument.load(await fs.readFile(out.path));
    assert.equal(check.getForm().getFields().length, 0);
    assert.match(await pdfText(out.path), /Ada Lovelace/);
    const live = await convert(dir, 'fill-pdf-form', [src], {
      values: '{"approved":true,"person":"Ada"}',
      flatten: false,
    });
    const liveForm = (await PDFDocument.load(await fs.readFile(live.path))).getForm();
    assert.ok(liveForm.getCheckBox('approved').isChecked());
    assert.equal(liveForm.getTextField('person').getText(), 'Ada');
    await assert.rejects(
      convert(dir, 'fill-pdf-form', [src], { values: '{"unknown":"x"}' }),
      /Available: approved, person/,
    );
  }));
test('PDF extraction returns original embedded image objects and real comparison diffs', () =>
  job(async (dir) => {
    const png = await sharp({
      create: { width: 32, height: 24, channels: 3, background: '#e52629' },
    })
      .png()
      .toBuffer();
    const d = await PDFDocument.create();
    d.addPage([200, 200]).drawImage(await d.embedPng(png), {
      x: 10,
      y: 10,
      width: 100,
      height: 75,
    });
    const src = await input(dir, 'images.pdf', await d.save());
    const extracted = await convert(dir, 'extract-pdf-images', [src]);
    const files = unzipSync(await fs.readFile(extracted.path));
    const index = JSON.parse(strFromU8(files['index.json']));
    assert.equal(index[0].width, 32);
    assert.equal((await sharp(files[index[0].file]).metadata()).height, 24);
    const before = await input(dir, 'before.pdf', await pdfBytes(['Before']));
    const after = await input(dir, 'after.pdf', await pdfBytes(['After']));
    const compared = await convert(dir, 'compare-pdfs', [before, after]);
    const zip = unzipSync(await fs.readFile(compared.path));
    const report = JSON.parse(strFromU8(zip['comparison.json']));
    assert.equal(report.pages[0].textEqual, false);
    assert.ok(report.pages[0].changedPixelFraction > 0);
    assert.ok(zip['difference-001.png']);
  }));
test('Table extraction exports actual CSV cells and an XLSX workbook; Markdown retains words', () =>
  job(async (dir) => {
    const d = await PDFDocument.create(),
      p = d.addPage([400, 300]);
    for (const x of [30, 180, 330])
      p.drawLine({ start: { x, y: 80 }, end: { x, y: 240 }, thickness: 1 });
    for (const y of [80, 120, 160, 200, 240])
      p.drawLine({ start: { x: 30, y }, end: { x: 330, y }, thickness: 1 });
    for (const [i, row] of [
      ['Name', 'Score'],
      ['Ada', '95'],
      ['Grace', '98'],
      ['Alan', '99'],
    ].entries()) {
      for (const [j, s] of row.entries())
        p.drawText(s, { x: 40 + j * 150, y: 215 - i * 40, size: 14 });
    }
    const src = await input(dir, 'table.pdf', await d.save());
    const csv = await convert(dir, 'pdf-tables', [src], { format: 'csv' });
    const files = unzipSync(await fs.readFile(csv.path));
    assert.match(strFromU8(Object.values(files)[0]), /Ada,+95/);
    const xlsx = await convert(dir, 'pdf-tables', [src]);
    const workbook = unzipSync(await fs.readFile(xlsx.path));
    assert.ok(workbook['xl/worksheets/sheet1.xml']);
    assert.match(strFromU8(workbook['xl/worksheets/sheet1.xml']), /Grace/);
    const md = await convert(dir, 'pdf-markdown', [src]);
    assert.match(await fs.readFile(md.path, 'utf8'), /Ada/);
  }));
test('FontTools WOFF2 and SFNT exports decode with original outlines', () =>
  job(async (dir) => {
    const src = await input(dir, 'font.ttf', await fs.readFile('C:/Windows/Fonts/arial.ttf'));
    const compressed = await convert(dir, 'convert-font', [src]);
    assert.equal((await fs.readFile(compressed.path)).subarray(0, 4).toString(), 'wOF2');
    const local = await input(dir, 'wrapped.woff2', await fs.readFile(compressed.path));
    const sfnt = await convert(dir, 'convert-font', [local], { format: 'sfnt' });
    assert.equal(path.extname(sfnt.path), '.ttf');
    assert.equal((await fs.readFile(sfnt.path)).readUInt32BE(0), 0x00010000);
  }));
test('Pandoc semantic DOCX, LibreOffice PDF/images and Calibre EPUB/MOBI render real content', () =>
  job(async (dir) => {
    const src = await input(
      dir,
      'source.md',
      Buffer.from('# Fixture title\n\nSemantic document content.\n\n- First item\n- Second item\n'),
    );
    const docx = await convert(dir, 'semantic-document', [src]);
    assert.ok(unzipSync(await fs.readFile(docx.path))['word/document.xml']);
    const office = await input(dir, 'fixture.docx', await fs.readFile(docx.path));
    const pdf = await convert(dir, 'office-render', [office]);
    assert.match(await pdfText(pdf.path), /Semantic document content/);
    const images = await convert(dir, 'office-render', [office], { format: 'png' });
    const zip = unzipSync(await fs.readFile(images.path));
    assert.ok((await sharp(Object.values(zip)[0]).metadata()).width > 100);
    const epub = await convert(dir, 'semantic-document', [src], { format: 'epub' });
    const ebook = await input(dir, 'fixture.epub', await fs.readFile(epub.path));
    const mobi = await convert(dir, 'convert-ebook', [ebook], { format: 'mobi' });
    assert.equal((await fs.readFile(mobi.path)).subarray(60, 68).toString(), 'BOOKMOBI');
    const mobiInput = await input(dir, 'fixture.mobi', await fs.readFile(mobi.path));
    const back = await convert(dir, 'convert-ebook', [mobiInput], { format: 'epub' });
    assert.ok(unzipSync(await fs.readFile(back.path))['mimetype']);
  }));
test('Local Chromium renders uploaded CSS and blocks network/active scripts', () =>
  job(async (dir) => {
    const html = await input(
      dir,
      'index.html',
      Buffer.from(
        '<!doctype html><html><head><link rel="stylesheet" href="style.css"></head><body><h1>Local rendering</h1><script>document.body.textContent="executed"</script><img src="https://example.invalid/never.png"></body></html>',
      ),
    );
    const css = await input(
      dir,
      'style.css',
      Buffer.from('body{margin:0;background:rgb(12,120,44);color:white}'),
    );
    const image = await convert(dir, 'render-html', [html, css], {
      format: 'png',
      width: 600,
      height: 400,
    });
    const meta = await sharp(image.path).metadata();
    assert.equal(meta.width, 600);
    const pixel = await sharp(image.path)
      .extract({ left: 590, top: 390, width: 1, height: 1 })
      .raw()
      .toBuffer();
    assert.deepEqual([...pixel].slice(0, 3), [12, 120, 44]);
    const pdf = await convert(dir, 'render-html', [html, css]);
    const text = await pdfText(pdf.path);
    assert.match(text, /Local rendering/);
    assert.doesNotMatch(text, /executed/);
  }));
test('LibreOffice imports XLSX cells and PPTX slide layout, and Calibre supports AZW3', () =>
  job(async (dir) => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Budget');
    sheet.getColumn(1).width = 45;
    sheet.addRow(['Office spreadsheet fixture', 123]);
    const xlsx = await input(dir, 'budget.xlsx', await workbook.xlsx.writeBuffer());
    const spreadsheet = await convert(dir, 'office-render', [xlsx]);
    assert.match(await pdfText(spreadsheet.path), /Office spreadsheet fixture/);
    const fodp = await input(
      dir,
      'slide.fodp',
      Buffer.from(
        '<?xml version="1.0" encoding="UTF-8"?><office:document xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" office:version="1.3" office:mimetype="application/vnd.oasis.opendocument.presentation"><office:body><office:presentation><draw:page draw:name="Fixture"><draw:frame svg:x="2cm" svg:y="2cm" svg:width="20cm" svg:height="4cm"><draw:text-box><text:p>Presentation layout fixture</text:p></draw:text-box></draw:frame></draw:page></office:presentation></office:body></office:document>',
      ),
    );
    await runProcess(
      path.join(root, '.tools/native/libreoffice/program/soffice.com'),
      [
        '-env:UserInstallation=' +
          new URL('file:///' + path.join(dir, 'fixture-office-profile').replaceAll('\\', '/')).href,
        '--headless',
        '--convert-to',
        'pptx',
        '--outdir',
        dir,
        fodp.path,
      ],
      { timeout: 90000 },
    );
    const pptx = await input(dir, 'slides.pptx', await fs.readFile(path.join(dir, 'slide.pptx')));
    const presentation = await convert(dir, 'office-render', [pptx]);
    assert.match(await pdfText(presentation.path), /Presentation layout fixture/);
    const md = await input(
      dir,
      'ebook.md',
      Buffer.from('# Ebook\n\nAZW3 conversion fixture text.'),
    );
    const epub = await convert(dir, 'semantic-document', [md], { format: 'epub' });
    const ebook = await input(dir, 'ebook.epub', await fs.readFile(epub.path));
    const azw = await convert(dir, 'convert-ebook', [ebook], { format: 'azw3' });
    assert.equal((await fs.readFile(azw.path)).subarray(60, 68).toString(), 'BOOKMOBI');
    const azwInput = await input(dir, 'source.azw3', await fs.readFile(azw.path));
    const text = await convert(dir, 'convert-ebook', [azwInput], { format: 'txt' });
    assert.match(await fs.readFile(text.path, 'utf8'), /AZW3 conversion fixture text/);
  }));
test('Local English OCR recognizes an image and creates searchable scanned PDF output', () =>
  job(async (dir) => {
    const svg = Buffer.from(
      '<svg width="1400" height="300"><rect width="100%" height="100%" fill="white"/><text x="50" y="170" font-size="80" font-family="Arial" fill="black">DOCUMENT OCR TEST 12345</text></svg>',
    );
    const png = await sharp(svg).png().toBuffer();
    const image = await input(dir, 'scan.png', png);
    const txt = await convert(dir, 'ocr-document', [image]);
    assert.match(await fs.readFile(txt.path, 'utf8'), /DOCUMENT OCR TEST 12345/);
    const d = await PDFDocument.create();
    d.addPage([700, 150]).drawImage(await d.embedPng(png), { x: 0, y: 0, width: 700, height: 150 });
    const scan = await input(dir, 'scan.pdf', await d.save());
    const searchable = await convert(dir, 'ocr-document', [scan], { format: 'pdf' });
    assert.match(await pdfText(searchable.path), /DOCUMENT OCR TEST 12345/);
  }));
test('Document tools reject unsupported settings and inputs outside job directory', () =>
  job(async (dir) => {
    const src = await input(dir, 'source.pdf', await pdfBytes());
    await assert.rejects(convert(dir, 'rotate-pdf', [src], { angle: '45' }), /Invalid/);
    await assert.rejects(
      convert(dir, 'rotate-pdf', [{ ...src, path: path.join(root, 'package.json') }]),
      /inside the conversion job/,
    );
  }));
test('Office rejects ODF external graphics, macros, XML entities and RTF linked fields before rendering', () =>
  job(async (dir) => {
    const packageFile = async (name, content, extra = {}) =>
      input(
        dir,
        name,
        zipSync({
          mimetype: strToU8('application/vnd.oasis.opendocument.text'),
          'content.xml': typeof content === 'string' ? strToU8(content) : content,
          ...extra,
        }),
      );
    for (const [index, href] of [
      'http://127.0.0.1:1/linked.png',
      'file:///C:/Windows/win.ini',
      '&#x66;ile:///C:/Windows/win.ini',
      '%68%74%74%70://127.0.0.1:1/test',
    ].entries()) {
      const src = await packageFile(
        `external${index}.odt`,
        `<doc xmlns:xlink="http://www.w3.org/1999/xlink"><image xlink:href="${href}"/></doc>`,
      );
      await assert.rejects(convert(dir, 'office-render', [src]), /External document resources/);
    }
    const macro = await packageFile('macro.odt', '<doc/>', {
      'Basic/Standard/Module1.xml': strToU8('<macro/>'),
    });
    await assert.rejects(convert(dir, 'office-render', [macro]), /macros and scripts/);
    const docx = await input(
      dir,
      'target.docx',
      zipSync({
        'word/document.xml': strToU8('<doc/>'),
        'word/_rels/document.xml.rels': strToU8(
          '<Relationships><Relationship Target="file:///C:/Windows/win.ini"/></Relationships>',
        ),
      }),
    );
    await assert.rejects(convert(dir, 'office-render', [docx]), /External relationship targets/);
    const formula = await input(
      dir,
      'formula.ods',
      zipSync({
        mimetype: strToU8('application/vnd.oasis.opendocument.spreadsheet'),
        'content.xml': strToU8(
          '<doc xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"><cell table:formula="of:=WEBSERVICE(&quot;http://127.0.0.1:1/test&quot;)"/></doc>',
        ),
      }),
    );
    await assert.rejects(convert(dir, 'office-render', [formula]), /External spreadsheet formulas/);
    const entity = await packageFile(
      'entity.odt',
      Buffer.from(
        '\ufeff<?xml version="1.0" encoding="UTF-16"?><!DOCTYPE doc [<!ENTITY x SYSTEM "file:///C:/Windows/win.ini">]><doc>&x;</doc>',
        'utf16le',
      ),
    );
    await assert.rejects(convert(dir, 'office-render', [entity]), /entities and doctypes/);
    const rtf = await input(
      dir,
      'external.rtf',
      Buffer.from('{\\rtf1 {\\field{\\*\\fldinst INCLUDEPICTURE "http://127.0.0.1:1/image.png"}}}'),
    );
    await assert.rejects(convert(dir, 'office-render', [rtf]), /RTF external fields/);
    await assert.rejects(convert(dir, 'semantic-document', [rtf]), /RTF external fields/);
  }));
