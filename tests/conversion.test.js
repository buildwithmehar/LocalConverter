import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import sharp from 'sharp';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import ExcelJS from 'exceljs';
import Papa from 'papaparse';
import YAML from 'yaml';
import { zipSync, unzipSync, gzipSync, gunzipSync, strToU8, strFromU8 } from 'fflate';

const engine = await import('../server/conversion/index.js').catch(() => null);
const run = (cmd, args) =>
  new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { shell: false, windowsHide: true });
    let out = '';
    let err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('error', reject);
    p.on('close', (c) => (c ? reject(new Error(err)) : resolve(out)));
  });

test(
  'registry exposes actual conversions and every pair produces decodable content',
  { timeout: 240000 },
  async (t) => {
    assert.ok(engine, 'conversion engine must be implemented');
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'converter-test-'));
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    const fixtures = {};
    const put = async (id, data) => {
      fixtures[id] = path.join(root, `source.${id}`);
      await fs.writeFile(fixtures[id], data);
    };
    for (const id of ['png', 'jpg', 'webp', 'avif', 'gif', 'tiff'])
      await put(
        id,
        await sharp({ create: { width: 40, height: 30, channels: 3, background: '#d33227' } })
          .toFormat(id === 'jpg' ? 'jpeg' : id)
          .toBuffer(),
      );
    await put(
      'svg',
      '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="30"><rect width="40" height="30" fill="red"/></svg>',
    );
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    for (let i = 0; i < 2; i++)
      pdf.addPage([200, 100]).drawText('Hello Local Converter', { x: 10, y: 50, font, size: 12 });
    await put('pdf', await pdf.save());
    for (const [id, txt] of Object.entries({
      txt: 'Hello Local Converter',
      md: '# Hello Local Converter',
      html: '<h1>Hello Local Converter</h1>',
      csv: 'name,code\nAlice,00123\n',
      tsv: 'name\tcode\nAlice\t00123\n',
      json: '[{"name":"Alice","code":"00123"}]',
      yaml: '- name: Alice\n  code: "00123"\n',
      srt: '1\n00:00:00,000 --> 00:00:01,000\nHello Local Converter\n',
      vtt: 'WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nHello Local Converter\n',
    }))
      await put(id, txt);
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet('Data');
    sheet.addRows([
      ['name', 'code'],
      ['Alice', '00123'],
    ]);
    await put('xlsx', await book.xlsx.writeBuffer());
    await put(
      'docx',
      zipSync({
        '[Content_Types].xml': strToU8(
          '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
        ),
        '_rels/.rels': strToU8(
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
        ),
        'word/document.xml': strToU8(
          '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Hello Local Converter</w:t></w:r></w:p></w:body></w:document>',
        ),
      }),
    );
    await put('gz', gzipSync(strToU8('Hello Local Converter')));
    await put('zip', zipSync({ 'hello.txt': strToU8('Hello Local Converter') }));
    const registry = await engine.getRegistry();
    assert.ok(registry.pairs.length >= 75);
    if (registry.dependencies.find((d) => d.name === '7-Zip')?.available) {
      const { detectArchiver } = await import('../server/conversion/native-archives.js');
      const tool = await detectArchiver();
      const hello = path.join(root, 'hello.txt');
      await fs.writeFile(hello, 'Hello Local Converter');
      for (const id of ['7z', 'tar']) {
        fixtures[id] = path.join(root, `source.${id}`);
        await run(tool.executable, ['a', `-t${id}`, '-y', fixtures[id], hello]);
      }
    }
    const mediaSources = [
      ...new Set(registry.pairs.filter((p) => p.engine === 'FFmpeg').map((p) => p.source)),
    ];
    for (const id of mediaSources) {
      fixtures[id] = path.join(root, `source.${id}`);
      const video = ['mp4', 'webm', 'mov', 'mkv'].includes(id);
      const codecs = {
        mp3: ['-c:a', 'libmp3lame'],
        wav: ['-c:a', 'pcm_s16le'],
        flac: ['-c:a', 'flac'],
        ogg: ['-c:a', 'libvorbis'],
        m4a: ['-c:a', 'aac'],
        aiff: ['-c:a', 'pcm_s16be'],
        mp4: ['-c:v', 'libx264', '-c:a', 'aac'],
        mov: ['-c:v', 'libx264', '-c:a', 'aac'],
        mkv: ['-c:v', 'libx264', '-c:a', 'aac'],
        webm: ['-c:v', 'libvpx-vp9', '-c:a', 'libopus'],
      }[id];
      await run('ffmpeg', [
        '-hide_banner',
        '-loglevel',
        'error',
        '-y',
        ...(video ? ['-f', 'lavfi', '-i', 'color=c=red:s=40x30:r=10'] : []),
        '-f',
        'lavfi',
        '-i',
        'sine=frequency=400:sample_rate=44100',
        '-t',
        '0.3',
        ...codecs,
        fixtures[id],
      ]);
    }
    for (const pair of registry.pairs)
      await t.test(`${pair.source} to ${pair.target}`, async () => {
        const out = path.join(root, `${pair.source}-${pair.target}`);
        await fs.mkdir(out);
        const result = await engine.convert({
          inputPath: fixtures[pair.source],
          outputDir: out,
          source: pair.source,
          target: pair.target,
        });
        const data = await fs.readFile(result.path);
        assert.ok(data.length > 0);
        assert.equal(path.dirname(result.path), out);
        assert.ok(result.mime);
        if (pair.engine === '7-Zip') {
          const { detectArchiver } = await import('../server/conversion/native-archives.js');
          const tool = await detectArchiver();
          const content = await run(tool.executable, [
            'e',
            '-so',
            '-spd',
            result.path,
            '--',
            'hello.txt',
          ]);
          assert.equal(content, 'Hello Local Converter');
        } else if (
          ['png', 'jpg', 'webp', 'avif', 'gif', 'tiff'].includes(pair.target) &&
          pair.source !== 'pdf'
        ) {
          const meta = await sharp(data).metadata();
          assert.ok(meta.width > 0);
          assert.ok(meta.height > 0);
          assert.equal(
            meta.format,
            pair.target === 'jpg' ? 'jpeg' : pair.target === 'avif' ? 'heif' : pair.target,
          );
        } else if (pair.target === 'pdf') {
          const decoded = await PDFDocument.load(data);
          assert.ok(decoded.getPageCount() > 0);
          if (['txt', 'md', 'html'].includes(pair.source)) {
            const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
            const task = pdfjs.getDocument({
              data: new Uint8Array(data),
              isEvalSupported: false,
              verbosity: 0,
            });
            const document = await task.promise;
            const text = await (await document.getPage(1)).getTextContent();
            assert.match(text.items.map((i) => i.str).join(' '), /Hello Local Converter/);
            await task.destroy();
          }
        } else if (pair.engine === 'FFmpeg') {
          const decoded = JSON.parse(
            await run('ffprobe', [
              '-v',
              'error',
              '-show_format',
              '-show_streams',
              '-of',
              'json',
              result.path,
            ]),
          );
          assert.ok(decoded.streams.length > 0);
          assert.ok(Number(decoded.format.duration) > 0);
          assert.equal(
            decoded.streams[0].codec_name,
            {
              mp3: 'mp3',
              wav: 'pcm_s16le',
              flac: 'flac',
              ogg: 'vorbis',
              m4a: 'aac',
              aiff: 'pcm_s16be',
              mp4: 'h264',
              mov: 'h264',
              mkv: 'h264',
              webm: 'vp9',
              gif: 'gif',
            }[pair.target],
          );
          if (['mp4', 'webm', 'mov', 'mkv', 'gif'].includes(pair.target)) {
            assert.ok(decoded.streams[0].width > 0);
            assert.ok(decoded.streams[0].height > 0);
          }
          assert.ok(Number(decoded.format.duration) < 1);
        } else if (pair.engine === 'Data') {
          let rows;
          if (pair.target === 'json') rows = JSON.parse(data);
          if (pair.target === 'yaml') rows = YAML.parse(data.toString());
          if (['csv', 'tsv'].includes(pair.target))
            rows = Papa.parse(data.toString(), {
              header: true,
              delimiter: pair.target === 'tsv' ? '\t' : ',',
            }).data;
          if (pair.target === 'xlsx') {
            const b = new ExcelJS.Workbook();
            await b.xlsx.load(data);
            rows = [
              {
                name: b.worksheets[0].getCell('A2').value,
                code: b.worksheets[0].getCell('B2').value,
              },
            ];
          }
          assert.deepEqual(rows[0], { name: 'Alice', code: '00123' });
        } else if (result.mime === 'application/zip') {
          const entries = unzipSync(data);
          assert.ok(Object.keys(entries).length > 0);
          if (pair.source === 'pdf') {
            assert.equal(Object.keys(entries).length, 2);
            for (const entry of Object.values(entries)) {
              const m = await sharp(entry).metadata();
              assert.equal(m.format, pair.target === 'jpg' ? 'jpeg' : 'png');
              assert.ok(m.width > 0);
            }
          } else assert.match(strFromU8(Object.values(entries)[0]), /Hello Local Converter/);
        } else if (pair.target === 'gz') {
          const expanded = gunzipSync(data);
          if (pair.source === 'zip')
            assert.match(strFromU8(unzipSync(expanded)['hello.txt']), /Hello Local Converter/);
          else assert.equal(strFromU8(expanded), 'Hello Local Converter');
        } else if (['txt', 'html', 'srt', 'vtt'].includes(pair.target))
          assert.match(data.toString(), /Hello Local Converter/);
      });
  },
);

test('rejects corrupt signatures, unsafe content, unsupported pairs, invalid options and resource excess', async (t) => {
  assert.ok(engine, 'conversion engine must be implemented');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'converter-invalid-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'file');
  await fs.writeFile(file, 'not an image');
  const call = (source, target, options = {}) =>
    engine.convert({ inputPath: file, outputDir: root, source, target, options });
  await assert.rejects(call('png', 'jpg'));
  await assert.rejects(call('txt', 'mp4'));
  await assert.rejects(call('txt', 'pdf', { unknown: true }));
  await assert.rejects(call('png', 'jpg', { width: 99999 }));
  await fs.writeFile(
    file,
    '<svg xmlns="http://www.w3.org/2000/svg"><image href="file:///etc/passwd"/></svg>',
  );
  await assert.rejects(call('svg', 'png'));
  await fs.writeFile(file, zipSync({ '../escape.txt': strToU8('secret') }));
  await assert.rejects(call('zip', 'gz'));
  await fs.writeFile(file, '{"x":1}');
  await assert.rejects(call('json', 'csv'));
  await fs.writeFile(file, 'name,code\nAlice,00123');
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(
    engine.convert({
      inputPath: file,
      outputDir: root,
      source: 'csv',
      target: 'json',
      signal: abort.signal,
    }),
  );
  await fs.writeFile(file, '\u0000broken');
  await assert.rejects(call('txt', 'pdf'));
});

test('resize and quality options apply, and multipage PDF returns one page archive', async (t) => {
  assert.ok(engine, 'conversion engine must be implemented');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'converter-options-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'input.png');
  await sharp({ create: { width: 80, height: 60, channels: 3, background: 'blue' } })
    .png()
    .toFile(file);
  const stages = [];
  const result = await engine.convert({
    inputPath: file,
    outputDir: root,
    source: 'png',
    target: 'jpg',
    options: { width: 20, quality: 35 },
    onProgress: (p) => stages.push(p),
  });
  const meta = await sharp(result.path).metadata();
  assert.equal(meta.width, 20);
  assert.equal(meta.height, 15);
  assert.ok(stages.length);
  assert.ok(stages.every((s) => s.progress === null || (s.progress >= 0 && s.progress <= 100)));
  const pdf = await PDFDocument.create();
  pdf.addPage([100, 100]);
  pdf.addPage([100, 100]);
  await fs.writeFile(file, await pdf.save());
  const pages = await engine.convert({
    inputPath: file,
    outputDir: root,
    source: 'pdf',
    target: 'png',
  });
  assert.equal(pages.mime, 'application/zip');
  assert.equal(Object.keys(unzipSync(await fs.readFile(pages.path))).length, 2);
  const one = await engine.convert({
    inputPath: file,
    outputDir: root,
    source: 'pdf',
    target: 'jpg',
    options: { page: 2, scale: 1 },
  });
  assert.equal(one.mime, 'image/jpeg');
  assert.equal((await sharp(one.path).metadata()).width, 100);
});

test('GZIP checksum corruption and expansion bombs fail without downloadable artifacts', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'converter-archive-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'bad.gz');
  const corrupted = Buffer.from(gzipSync(strToU8('Hello')));
  corrupted[corrupted.length - 8] ^= 255;
  await fs.writeFile(file, corrupted);
  await assert.rejects(
    engine.convert({ inputPath: file, outputDir: root, source: 'gz', target: 'zip' }),
  );
  await fs.writeFile(file, gzipSync(new Uint8Array(101 * 1024 * 1024)));
  await assert.rejects(
    engine.convert({ inputPath: file, outputDir: root, source: 'gz', target: 'zip' }),
  );
  assert.deepEqual(
    (await fs.readdir(root)).filter((x) => x.startsWith('converted-')),
    [],
  );
});

test('ZIP checksum corruption and duplicate paths are rejected before parsing documents', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'converter-zip-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'bad.zip');
  const zip = Buffer.from(zipSync({ 'hello.txt': strToU8('Hello') }, { level: 0 }));
  const content = zip.indexOf(Buffer.from('Hello'));
  zip[content] ^= 32;
  await fs.writeFile(file, zip);
  await assert.rejects(
    engine.convert({ inputPath: file, outputDir: root, source: 'zip', target: 'gz' }),
  );
});

test('large input and PDF page caps are enforced before producing an output', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'converter-caps-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'large');
  const fd = await fs.open(file, 'w');
  await fd.truncate(101 * 1024 * 1024);
  await fd.close();
  await assert.rejects(
    engine.convert({ inputPath: file, outputDir: root, source: 'txt', target: 'pdf' }),
  );
  const pdf = await PDFDocument.create();
  for (let i = 0; i < 101; i++) pdf.addPage([10, 10]);
  await fs.writeFile(file, await pdf.save());
  await assert.rejects(
    engine.convert({ inputPath: file, outputDir: root, source: 'pdf', target: 'txt' }),
  );
});

test(
  'media trimming settings change duration and cancelling an encoder removes partial output',
  { timeout: 30000 },
  async (t) => {
    const registry = await engine.getRegistry();
    if (!registry.pairs.some((p) => p.source === 'wav' && p.target === 'mp3'))
      return t.skip('FFmpeg is not available');
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'converter-media-'));
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    const input = path.join(root, 'source.wav');
    await run('ffmpeg', [
      '-hide_banner',
      '-loglevel',
      'error',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=400',
      '-t',
      '3',
      input,
    ]);
    const output = await engine.convert({
      inputPath: input,
      outputDir: root,
      source: 'wav',
      target: 'mp3',
      options: { start: 1, duration: 1, audioBitrate: 64 },
    });
    const probe = JSON.parse(
      await run('ffprobe', [
        '-v',
        'error',
        '-show_format',
        '-show_streams',
        '-of',
        'json',
        output.path,
      ]),
    );
    assert.ok(Number(probe.format.duration) > 0.9 && Number(probe.format.duration) < 1.2);
    assert.equal(probe.streams[0].codec_name, 'mp3');
    assert.equal(Number(probe.streams[0].bit_rate), 64000);
    await fs.rm(output.path);
    const controller = new AbortController();
    await assert.rejects(
      engine.convert({
        inputPath: input,
        outputDir: root,
        source: 'wav',
        target: 'mp3',
        signal: controller.signal,
        onProgress: ({ stage }) => {
          if (stage === 'Encoding media') controller.abort();
        },
      }),
    );
    assert.deepEqual(
      (await fs.readdir(root)).filter((x) => x.startsWith('converted-')),
      [],
    );
  },
);

test('rasterized PDF contains visible text and JPEG quality changes encoded size', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'converter-content-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const input = path.join(root, 'input');
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  pdf.addPage([200, 100]).drawText('Visible text', { x: 10, y: 50, font, size: 20 });
  await fs.writeFile(input, await pdf.save());
  const raster = await engine.convert({
    inputPath: input,
    outputDir: root,
    source: 'pdf',
    target: 'png',
    options: { page: 1, scale: 1 },
  });
  const stats = await sharp(raster.path).stats();
  assert.ok(stats.channels[0].min < 100);
  assert.ok(stats.channels[0].mean < 254);
  const raw = Buffer.alloc(128 * 128 * 3);
  for (let i = 0; i < raw.length; i++) raw[i] = (i * 31 + (i % 7) * 19) % 256;
  await fs.writeFile(
    input,
    await sharp(raw, { raw: { width: 128, height: 128, channels: 3 } })
      .png()
      .toBuffer(),
  );
  const low = await engine.convert({
    inputPath: input,
    outputDir: root,
    source: 'png',
    target: 'jpg',
    options: { quality: 10 },
  });
  const high = await engine.convert({
    inputPath: input,
    outputDir: root,
    source: 'png',
    target: 'jpg',
    options: { quality: 95 },
  });
  assert.ok((await fs.stat(high.path)).size > (await fs.stat(low.path)).size * 2);
});

test('SVG processing instructions and CSS escapes cannot load external resources', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'converter-svg-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'input.svg');
  await fs.writeFile(
    file,
    '<?xml-stylesheet type="text/css" href="https://example.invalid/remote.css"?><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>',
  );
  await assert.rejects(
    engine.convert({ inputPath: file, outputDir: root, source: 'svg', target: 'png' }),
  );
  await fs.writeFile(
    file,
    '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><style>@\\69mport "https://example.invalid/remote.css";</style><rect width="10" height="10"/></svg>',
  );
  await assert.rejects(
    engine.convert({ inputPath: file, outputDir: root, source: 'svg', target: 'png' }),
  );
});

test('PDF text extraction reports missing selectable text instead of a blank multipage download', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'converter-blank-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'input.pdf');
  const pdf = await PDFDocument.create();
  pdf.addPage();
  pdf.addPage();
  await fs.writeFile(file, await pdf.save());
  await assert.rejects(
    engine.convert({ inputPath: file, outputDir: root, source: 'pdf', target: 'txt' }),
  );
});

test('image resizing cannot expand beyond the pixel budget', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'converter-resizecap-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'input.png');
  await sharp({ create: { width: 1000, height: 1000, channels: 3, background: 'white' } })
    .png()
    .toFile(file);
  await assert.rejects(
    engine.convert({
      inputPath: file,
      outputDir: root,
      source: 'png',
      target: 'jpg',
      options: { width: 8192 },
    }),
  );
});

test('PDFKit Helvetica text renders visibly using only local PDF assets', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'converter-pdffont-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const input = path.join(root, 'input.txt');
  await fs.writeFile(input, 'Hello Local Converter');
  const doc = await engine.convert({
    inputPath: input,
    outputDir: root,
    source: 'txt',
    target: 'pdf',
  });
  const png = await engine.convert({
    inputPath: doc.path,
    outputDir: root,
    source: 'pdf',
    target: 'png',
    options: { page: 1, scale: 1 },
  });
  const stats = await sharp(png.path).stats();
  assert.ok(stats.channels[0].min < 100);
  assert.ok(stats.channels[0].mean < 254.95);
});

test('missing native tools remove media conversions from the registry', async () => {
  const code = `const {getRegistry}=await import(${JSON.stringify(new URL('../server/conversion/index.js', import.meta.url).href)});console.log(JSON.stringify(await getRegistry()));`;
  const text = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', code], {
      shell: false,
      windowsHide: true,
      env: { ...process.env, PATH: '' },
    });
    let output = '',
      error = '';
    child.stdout.on('data', (d) => (output += d));
    child.stderr.on('data', (d) => (error += d));
    child.on('error', reject);
    child.on('close', (c) => (c ? reject(new Error(error)) : resolve(output)));
  });
  const registry = JSON.parse(text);
  assert.equal(
    registry.pairs.some((p) => p.engine === 'FFmpeg'),
    false,
  );
  assert.equal(registry.dependencies.find((d) => d.name === 'FFmpeg / FFprobe').available, false);
  assert.ok(registry.pairs.some((p) => p.source === 'png' && p.target === 'jpg'));
});
