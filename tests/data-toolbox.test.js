import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { unzipSync, zipSync } from 'fflate';
import { convertTool, validateToolOptions } from '../server/conversion/everyday.js';
import { toolDefaults, everydayTools } from '../shared/everyday-tools.js';

async function fixture(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lc-data-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  let count = 0;
  return async (id, data, source = 'txt', options = {}, other = []) => {
    const inputPath = path.join(dir, `input-${++count}.${source}`);
    await fs.writeFile(inputPath, data);
    const result = await convertTool({
      operation: id,
      inputs: [{ path: inputPath, source, name: `input.${source}`, size: data.length }, ...other],
      outputDir: dir,
      options: { ...toolDefaults(id), ...options },
    });
    return { ...result, buffer: await fs.readFile(result.path) };
  };
}
test('all 70 roadmap families have unique, validated definitions', () => {
  const families = new Set(everydayTools.flatMap((tool) => tool.family || []));
  for (let i = 1; i <= 70; i++) assert.ok(families.has(i), `Missing family ${i}`);
  assert.equal(new Set(everydayTools.map((t) => t.id)).size, everydayTools.length);
  for (const tool of everydayTools) {
    assert.deepEqual(validateToolOptions(tool.id, {}), toolDefaults(tool.id));
    assert.throws(() => validateToolOptions(tool.id, { rogue: true }));
  }
});
test('image Base64 and SVGZ roundtrip preserve real image bytes', async (t) => {
  const run = await fixture(t),
    png = await sharp({ create: { width: 20, height: 12, channels: 3, background: 'red' } })
      .png()
      .toBuffer();
  const encoded = await run('image-base64', png, 'png');
  const decoded = await run('image-base64', encoded.buffer, 'txt', { mode: 'decode' });
  assert.deepEqual(decoded.buffer, png);
  assert.equal(decoded.mime, 'image/png');
  const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>',
    ),
    gz = await run('svg-gzip', svg, 'svg'),
    restored = await run('svg-gzip', gz.buffer, 'svgz');
  assert.deepEqual(restored.buffer, svg);
  await assert.rejects(
    run('image-base64', Buffer.from('abc!'), 'txt', { mode: 'decode' }),
    /Base64/,
  );
});
test('structured data, formatting and CSV cleaning produce parsed outputs', async (t) => {
  const run = await fixture(t),
    json = Buffer.from('{"name":"Local","nested":{"enabled":true},"values":[1,2]}');
  for (const format of ['yaml', 'toml', 'xml']) {
    const out = await run('structured-data', json, 'json', { format });
    assert.ok(out.buffer.toString().includes('Local'));
  }
  const formatted = await run('format-data', json, 'json', { style: 'minify' });
  assert.deepEqual(JSON.parse(formatted.buffer), JSON.parse(json));
  const csv = await run('clean-csv', Buffer.from('name, value\na, 1\na, 1\nb, 2'), 'csv', {
    outputDelimiter: '\t',
  });
  assert.equal(csv.details.duplicatesRemoved, 1);
  assert.match(csv.buffer.toString(), /a\t1/);
  await assert.rejects(
    run('structured-data', Buffer.from('<!DOCTYPE x><x/>'), 'xml', { input: 'xml' }),
    /entities/,
  );
  await assert.rejects(run('format-data', Buffer.from('{broken'), 'json'));
});
test('hashes and character encodings are verifiable', async (t) => {
  const run = await fixture(t),
    data = Buffer.from('Hello & café');
  const out = await run('file-checksum', data, 'txt', {
    expected: createHash('sha256').update(data).digest('hex'),
  });
  assert.equal(JSON.parse(out.buffer).matches, true);
  for (const mode of ['base64', 'url', 'html']) {
    const encoded = await run('text-encoding', data, 'txt', { mode: mode + '-encode' }),
      decoded = await run('text-encoding', encoded.buffer, 'txt', { mode: mode + '-decode' });
    assert.deepEqual(decoded.buffer, data);
  }
  const wide = await run('text-encoding', data, 'txt', { to: 'utf16le' }),
    back = await run('text-encoding', wide.buffer, 'txt', { from: 'utf16le' });
  assert.deepEqual(back.buffer, data);
});
test('QR generator and reader roundtrip, barcode and palette decode', async (t) => {
  const run = await fixture(t);
  const qr = await run('create-code', Buffer.from('https://localconverter.dev'), 'txt');
  const decoded = await run('read-code', qr.buffer, 'png');
  assert.equal(decoded.buffer.toString(), 'https://localconverter.dev');
  const svg = await run('create-code', Buffer.from('123456789012'), 'txt', {
    kind: 'ean13',
    format: 'svg',
  });
  assert.match(svg.buffer.toString(), /<svg/);
  const palette = await run('color-palette', Buffer.from('#336699'));
  const files = unzipSync(palette.buffer);
  assert.equal(JSON.parse(Buffer.from(files['palette.json'])).base.hex, '#336699');
  assert.ok(files['palette.svg']);
});
test('archive inventory, safe extraction and compressed TAR formats roundtrip', async (t) => {
  const run = await fixture(t),
    zip = Buffer.from(
      zipSync({ 'a.txt': Buffer.from('hello'), 'folder/b.txt': Buffer.from('world') }),
    );
  const inventory = await run('archive-browser', zip, 'zip');
  assert.equal(JSON.parse(inventory.buffer).files.length, 2);
  const filtered = await run('archive-browser', zip, 'zip', { mode: 'extract', contains: 'b.txt' });
  assert.deepEqual(Object.keys(unzipSync(filtered.buffer)), ['folder/b.txt']);
  const created = await run('create-archive', Buffer.from('hello'), 'txt');
  assert.equal(Buffer.from(unzipSync(created.buffer)['input.txt']).toString(), 'hello');
  for (const format of ['tar', 'tar.gz', 'tar.bz2', 'tar.xz', '7z']) {
    const archive = await run('create-archive', Buffer.from('sample'), 'txt', { format });
    const unpacked = await run('archive-browser', archive.buffer, format, { mode: 'extract' });
    assert.equal(Buffer.from(unzipSync(unpacked.buffer)['input.txt']).toString(), 'sample');
  }
  await assert.rejects(
    run('archive-browser', Buffer.from(zipSync({ '../escape.txt': Buffer.from('bad') })), 'zip'),
    /Unsafe/,
  );
});

test('XML formatting preserves entities, original root and mixed text order', async (t) => {
  const run = await fixture(t);
  for (const style of ['pretty', 'minify']) {
    const out = await run(
      'format-data',
      Buffer.from('<p>Hello <b>bold</b> world &amp; friends</p>'),
      'xml',
      { input: 'xml', style },
    );
    assert.equal(out.buffer.toString(), '<p>Hello <b>bold</b> world &amp; friends</p>');
  }
  const out = await run(
    'structured-data',
    Buffer.from('<people><person id="1">Alice &amp; Bob</person></people>'),
    'xml',
    { input: 'xml', format: 'xml' },
  );
  assert.doesNotMatch(out.buffer.toString(), /<root>|amp;amp/);
});
