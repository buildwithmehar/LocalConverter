import test from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync, zipSync, strToU8 } from 'fflate';
import { PDFDocument } from 'pdf-lib';
import { convert } from '../src/browser/utility-engine.js';
const input = (data, name = 'input.txt', source = name.split('.').pop()) => ({
  file: new Blob([data]),
  name,
  source,
});
const run = (operation, data = '', options = {}, extras = []) =>
  convert({ operation, inputs: [input(data), ...extras], options });
const json = async (result) => JSON.parse(await result.blob.text());
test('browser hash and HMAC compute actual SHA-256 bytes', async () => {
  assert.equal(
    (await json(await run('hash-text', 'abc', { algorithm: 'sha256', mode: 'hash' }))).digest,
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  );
  assert.equal(
    (
      await json(
        await run('hash-text', 'The quick brown fox jumps over the lazy dog', {
          algorithm: 'sha256',
          mode: 'hmac',
          secret: 'key',
        }),
      )
    ).digest,
    'f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8',
  );
});
test('structured conversion preserves values and rejects unsafe data', async () => {
  const out = await run('structured-data', 'answer = 42\nname = "café"', {
    input: 'toml',
    format: 'json',
  });
  assert.deepEqual(await json(out), { answer: 42, name: 'café' });
  await assert.rejects(
    run('structured-data', '{"__proto__":{}}', { input: 'json', format: 'yaml' }),
    /Reserved/,
  );
  await assert.rejects(
    run('format-data', '<!DOCTYPE a [<!ENTITY x SYSTEM "https://example.com">]><a>&x;</a>', {
      input: 'xml',
    }),
    /entities|document types/i,
  );
});
test('ZIP and TAR.GZ preserve member bytes, inventory filters, reject traversal', async () => {
  const files = [input('hello', 'a.txt'), input('café', 'b.txt')];
  for (const format of ['zip', 'tar', 'tar.gz']) {
    const archive = await convert({
      operation: 'create-archive',
      inputs: files,
      options: { format },
    });
    const inventory = await convert({
      operation: 'archive-browser',
      inputs: [{ file: archive.blob, name: 'archive.' + format, source: format }],
      options: { mode: 'list', contains: 'b.' },
    });
    assert.deepEqual((await json(inventory)).files, [
      { path: 'b.txt', bytes: 5, directory: false },
    ]);
    if (format === 'zip')
      assert.equal(
        new TextDecoder().decode(
          unzipSync(new Uint8Array(await archive.blob.arrayBuffer()))['b.txt'],
        ),
        'café',
      );
  }
  const bad = zipSync({ '../escape.txt': strToU8('bad') });
  await assert.rejects(
    convert({
      operation: 'archive-browser',
      inputs: [input(bad, 'bad.zip')],
      options: { mode: 'list' },
    }),
    /Unsafe/,
  );
});
test('CSV cleaner handles quoting and exact large-number base conversion', async () => {
  const csv = await run('clean-csv', 'a,b\n" one ","two,three"\n" one ","two,three"', {
    delimiter: ',',
    outputDelimiter: ';',
    trim: true,
    deduplicate: true,
    emptyRows: true,
  });
  assert.equal(await csv.blob.text(), 'a;b\r\none;two,three');
  assert.equal(
    await (await run('number-base', '9007199254740993', { from: 10, to: 16 })).blob.text(),
    '20000000000001',
  );
});
test('legacy encoding conversion is real and rejects lossy output', async () => {
  const r = await run('text-encoding', '€ café', {
    mode: 'encoding',
    from: 'utf8',
    to: 'windows1252',
  });
  assert.deepEqual([...new Uint8Array(await r.blob.arrayBuffer())], [128, 32, 99, 97, 102, 233]);
  await assert.rejects(
    run('text-encoding', '你好', { mode: 'encoding', from: 'utf8', to: 'windows1252' }),
    /represented/,
  );
});
test('PDF report edits metadata and rebuilds actual page size', async () => {
  const pdf = await PDFDocument.create();
  pdf.addPage([200, 300]);
  pdf.setTitle('Original');
  const files = [input(await pdf.save(), 'a.pdf')];
  const edited = await convert({
    operation: 'pdf-metadata',
    inputs: files,
    options: {
      mode: 'edit',
      title: 'Browser',
      author: 'Alice',
      subject: 'Test',
      keywords: 'one, two',
    },
  });
  const actual = await PDFDocument.load(await edited.blob.arrayBuffer());
  assert.equal(actual.getTitle(), 'Browser');
  assert.equal(actual.getAuthor(), 'Alice');
  const resized = await convert({
    operation: 'pdf-page-size',
    inputs: files,
    options: { paper: 'letter', margin: 24 },
  });
  const size = (await PDFDocument.load(await resized.blob.arrayBuffer())).getPages()[0].getSize();
  assert.deepEqual(size, { width: 612, height: 792 });
});
test('file inspector examines actual bytes and cancellation prevents results', async () => {
  const r = await convert({
    operation: 'inspect-file',
    inputs: [input(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]), 'fake.jpg')],
    options: {},
  });
  const v = await json(r);
  assert.equal(v.detected, 'png');
  assert.equal(v.extensionMatches, false);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    convert({ operation: 'count-text', inputs: [input('test')], signal: controller.signal }),
    /cancel/i,
  );
});
test('archive integrity rejects damaged stored payload and forged expansion size', async () => {
  const archive = zipSync({ 'a.txt': strToU8('hello') }, { level: 0 });
  const damaged = archive.slice();
  damaged[35] ^= 1;
  await assert.rejects(
    convert({
      operation: 'archive-browser',
      inputs: [input(damaged, 'bad.zip')],
      options: { mode: 'list' },
    }),
    /checksum|corrupt|size/i,
  );
  const forged = archive.slice();
  const view = new DataView(forged.buffer);
  let central = 0;
  for (let i = 0; i < forged.length - 4; i++)
    if (view.getUint32(i, true) === 0x02014b50) {
      central = i;
      break;
    }
  view.setUint32(central + 24, 101 * 1024 * 1024, true);
  await assert.rejects(
    convert({
      operation: 'archive-browser',
      inputs: [input(forged, 'bad.zip')],
      options: { mode: 'list' },
    }),
    /limit/i,
  );
});
test('data pairs preserve quoted tables, spreadsheet values and subtitle timing', async () => {
  const { convertDataPair } = await import('../src/browser/utility-engine.js');
  const table = await convertDataPair({
    source: 'csv',
    target: 'json',
    file: new Blob(['name,note\nAlice,"two, three"\nBob,plain']),
  });
  assert.deepEqual(await json(table), [
    { name: 'Alice', note: 'two, three' },
    { name: 'Bob', note: 'plain' },
  ]);
  const xlsx = await convertDataPair({
    source: 'json',
    target: 'xlsx',
    file: new Blob(['[{"name":"café","amount":42,"ok":true}]']),
  });
  assert.equal(
    new TextDecoder().decode(new Uint8Array(await xlsx.blob.arrayBuffer()).subarray(0, 2)),
    'PK',
  );
  const decoded = await convertDataPair({ source: 'xlsx', target: 'json', file: xlsx.blob });
  assert.deepEqual(await json(decoded), [{ name: 'café', amount: 42, ok: true }]);
  const vtt = await convertDataPair({
    source: 'srt',
    target: 'vtt',
    file: new Blob(['1\n00:00:01,200 --> 00:00:02,500\nHello\n']),
  });
  assert.equal(await vtt.blob.text(), 'WEBVTT\n\n00:00:01.200 --> 00:00:02.500\nHello\n');
  await assert.rejects(
    convertDataPair({ source: 'csv', target: 'json', file: new Blob(['name,name\na,b']) }),
    /duplicate|Malformed/i,
  );
});
test('productivity operations produce exact values without evaluating source', async () => {
  assert.equal(
    await (await run('change-case', 'Hello HTTP World', { style: 'camel' })).blob.text(),
    'helloHttpWorld',
  );
  assert.deepEqual(
    await json(await run('query-json', '{"items":[{"n":1},{"n":2}]}', { query: '$.items[*].n' })),
    [1, 2],
  );
  await assert.rejects(run('query-json', '{}', { query: '$..constructor' }), /non-executable/i);
  assert.equal(
    (
      await json(
        await run('decode-jwt', 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhbGljZSIsImV4cCI6MX0.abc'),
      )
    ).signatureVerified,
    false,
  );
  assert.equal((await json(await run('convert-units', '32', { from: 'F', to: 'C' }))).result, 0);
  assert.equal(
    (await json(await run('convert-timestamp', '0', { timezone: 'Asia/Karachi', unit: 'seconds' })))
      .iso,
    '1970-01-01T00:00:00.000Z',
  );
  const sql = await run('format-sql', 'select id,name from users where active=true;', {
    dialect: 'sql',
  });
  assert.match(await sql.blob.text(), /SELECT\s+id,/);
  const js = await run('format-code', 'const x = 1; // hello', {
    language: 'javascript',
    mode: 'minify',
  });
  assert.equal(await js.blob.text(), 'const x=1;');
  const css = await run('format-code', 'a { color: red; margin: 0px; }', {
    language: 'css',
    mode: 'minify',
  });
  assert.equal(await css.blob.text(), 'a{color:red;margin:0}');
});
test('DOM exports sanitize Markdown/DOCX while code formatter preserves source', async () => {
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  const previous = {};
  for (const k of [
    'window',
    'document',
    'DOMParser',
    'XMLSerializer',
    'Element',
    'Node',
    'HTMLElement',
    'SVGElement',
  ]) {
    previous[k] = globalThis[k];
    globalThis[k] = dom.window[k];
  }
  try {
    const markdown = await run(
      'markdown-editor',
      '# Title\n\n<script>alert(1)</script>\n\n[link](https://example.com)',
      { format: 'html' },
    );
    const html = await markdown.blob.text();
    assert.match(html, /<h1>Title<\/h1>/);
    assert.doesNotMatch(html, /<script|href="https:/i);
    assert.match(html, /Content-Security-Policy/);
    const source = await run(
      'format-code',
      '<script>const harmlessSource = 1;</script><p>Hello</p>',
      { language: 'html', mode: 'format' },
    );
    assert.match(await source.blob.text(), /<script>/);
    assert.match(await source.blob.text(), /harmlessSource/);
    const stats = await convert({
      operation: 'document-stats',
      inputs: [input('# Heading\n\nOne two.', 'a.md')],
      options: {},
    });
    assert.equal((await json(stats)).headings, 1);
    const docx = zipSync({
      '[Content_Types].xml': strToU8(
        '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
      ),
      '_rels/.rels': strToU8(
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
      ),
      'word/document.xml': strToU8(
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Hello browser</w:t></w:r></w:p></w:body></w:document>',
      ),
    });
    const preview = await convert({
      operation: 'docx-preview',
      inputs: [input(docx, 'a.docx')],
      options: {},
    });
    assert.match(await preview.blob.text(), /<p>Hello browser<\/p>/);
    assert.equal(preview.details.preview, 'Hello browser');
  } finally {
    for (const [k, v] of Object.entries(previous)) {
      if (v === undefined) delete globalThis[k];
      else globalThis[k] = v;
    }
    dom.window.close();
  }
});
test('remaining browser utilities produce useful bytes and validate unsafe inputs', async () => {
  const ids = (await (await run('generate-id', '', { kind: 'uuid', count: 3 })).blob.text())
    .trim()
    .split('\n');
  assert.equal(new Set(ids).size, 3);
  assert.ok(ids.every((x) => /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(x)));
  const passwords = await run('generate-password', '', {
    kind: 'password',
    length: 24,
    count: 4,
    uppercase: true,
    digits: true,
    symbols: true,
  });
  assert.deepEqual(passwords.details, {});
  assert.ok(
    (await passwords.blob.text())
      .trim()
      .split('\n')
      .every(
        (x) => x.length === 24 && /[A-Z]/.test(x) && /\d/.test(x) && /[!@#$%^&*_+=?-]/.test(x),
      ),
  );
  const url = await json(await run('inspect-url', 'https://example.com/path?x=1&x=2#section'));
  assert.deepEqual(url.query, [
    ['x', '1'],
    ['x', '2'],
  ]);
  await assert.rejects(run('inspect-url', 'file:///etc/passwd'), /HTTP/);
  assert.equal(
    await (await run('query-string', '[["x","1"],["x","2"]]', { mode: 'build' })).blob.text(),
    'x=1&x=2',
  );
  const diff = await json(await run('compare-text', 'a\nb\n', { second: 'a\nc\n' }));
  assert.ok(diff.some((x) => x.removed && x.value === 'b\n'));
  assert.ok(diff.some((x) => x.added && x.value === 'c\n'));
  const changed = await json(await run('compare-json', '{"a/b":1}', { second: '{"a/b":2}' }));
  assert.deepEqual(changed, [{ path: '/a~1b', kind: 'changed', before: 1, after: 2 }]);
  assert.equal(
    await (
      await run('clean-lines', ' b\na\nb\n', {
        trim: true,
        empty: true,
        deduplicate: true,
        sort: 'ascending',
      })
    ).blob.text(),
    'a\nb',
  );
  assert.equal(
    (await (await run('placeholder-text', '', { unit: 'words', count: 7 })).blob.text()).split(' ')
      .length,
    7,
  );
  const count = await json(await run('count-text', 'Hello world.\n\nSecond paragraph.'));
  assert.equal(count.words, 4);
  assert.equal(count.paragraphs, 2);
  const palette = await run('color-palette', '#336699', { steps: 3 });
  const members = unzipSync(new Uint8Array(await palette.blob.arrayBuffer()));
  assert.equal(JSON.parse(new TextDecoder().decode(members['palette.json'])).base.hex, '#336699');
  assert.match(new TextDecoder().decode(members['palette.svg']), /<svg/);
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="red"/></svg>';
  const packed = await convert({
    operation: 'svg-gzip',
    inputs: [input(svg, 'a.svg')],
    options: {},
  });
  const unpacked = await convert({
    operation: 'svg-gzip',
    inputs: [{ file: packed.blob, name: 'a.svgz', source: 'svgz' }],
    options: {},
  });
  assert.equal(await unpacked.blob.text(), svg);
  await assert.rejects(
    convert({
      operation: 'svg-gzip',
      inputs: [input('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>', 'a.svg')],
      options: {},
    }),
    /self-contained/,
  );
});
test('archive pairs preserve ZIP container for gzip and repack TAR members', async () => {
  const { convertDataPair } = await import('../src/browser/utility-engine.js');
  const { gunzipSync } = await import('fflate');
  const archive = zipSync({ 'one.bin': Uint8Array.of(255, 0, 200), 'two.txt': strToU8('hello') });
  const gzip = await convertDataPair({ source: 'zip', target: 'gz', file: new Blob([archive]) });
  assert.deepEqual(gunzipSync(new Uint8Array(await gzip.blob.arrayBuffer())), archive);
  const wrapped = await convertDataPair({ source: 'gz', target: 'zip', file: gzip.blob });
  assert.deepEqual(unzipSync(new Uint8Array(await wrapped.blob.arrayBuffer())).content, archive);
  const tar = await convertDataPair({ source: 'zip', target: 'tar', file: new Blob([archive]) });
  const zipped = await convertDataPair({ source: 'tar', target: 'zip', file: tar.blob });
  const entries = unzipSync(new Uint8Array(await zipped.blob.arrayBuffer()));
  assert.deepEqual(entries['one.bin'], Uint8Array.of(255, 0, 200));
  assert.equal(new TextDecoder().decode(entries['two.txt']), 'hello');
});
test('TAR input rejects short garbage instead of returning an empty inventory', async () => {
  await assert.rejects(
    convert({
      operation: 'archive-browser',
      inputs: [input('not a tar archive', 'bad.tar')],
      options: { mode: 'list' },
    }),
    /TAR|truncated|Invalid/i,
  );
});
test('SVG gzip and Base64 reject CSS escapes, base URI changes, SMIL and decoded attribute tricks', async () => {
  const payloads = [
    '<svg xmlns="http://www.w3.org/2000/svg"><rect style="fill:u\\72l(https://external.invalid/a)"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" xml:base="https://external.invalid/"><rect/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><animateTransform attributeName="transform"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><animateMotion path="M0 0 L10 10"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><rect style="fill:&#117;rl(https://external.invalid/a)"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><rect fill="&#92;75rl(https://external.invalid/a)"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><x:script xmlns:x="http://www.w3.org/2000/svg">alert(1)</x:script></svg>',
  ];
  for (const svg of payloads) {
    await assert.rejects(
      convert({ operation: 'svg-gzip', inputs: [input(svg, 'a.svg')], options: {} }),
      /self-contained|active content|SVG/i,
    );
    await assert.rejects(
      convert({
        operation: 'image-base64',
        inputs: [input(svg, 'a.svg')],
        options: { mode: 'encode', dataUri: true },
      }),
      /self-contained|active content|SVG/i,
    );
    const encoded = btoa(unescape(encodeURIComponent(svg)));
    await assert.rejects(
      run('image-base64', encoded, { mode: 'decode' }),
      /self-contained|active content|SVG/i,
    );
  }
});
